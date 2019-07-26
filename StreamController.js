"use strict";

const StreamController = function(audioObject, requestEntryPoint, desiredFragmentSize) {

    if (!audioObject ||(audioObject && !audioObject instanceof AudioObject))
        throw new Error("MEDIA: audioObject is defined or not an instance of AudioObject");

    this.debug = true;

    this.validStates = Object.freeze({
        READY: Symbol("READY"),
        CONNECTING: Symbol("CONNECTING"),
        READING_FROM_STREAM: Symbol("READING FROM STREAM"),
        UPDATING_AUDIO_OBJECT: Symbol("UPDATING AUDIO OBJECT"),
        ABORTED: Symbol("ABORTED"),
        COMPLETED: Symbol("COMPLETED")
    });

    this.STREAM_REQUEST_ENTRY_POINT = requestEntryPoint || "ERROR";
    this.abortController = new AbortController();
    this.audioObject = audioObject; // Instance of AudioObject
    this.reader = {}; // Instance of ReadableStreamDefaultReader
    // Have to reconsider reversing this relationship so that the mediaController reads these values from the stream
    this.complete = false;
    this.nextFragment = -1;

    this.FRAGMENT_THRESHOLD = desiredFragmentSize || 512 * 1024; // Threshold at which existing chunks are combined (called a "fragment") and handed to the audio object
    this.chunkBuffer = new Set(); // Holds the chunks read from the stream, which gets purged every time the threshold is reached, and a fragment is created from the combined chunks available

    this.events = Object.seal({
        streamComplete: null,
        fragmentAvailable: null
    });

    // Locking properties
    Object.defineProperties(this, {
        "validStates": {configurable: false, enumerable: true, writable: false},
        "STREAM_REQUEST_ENTRY_POINT": {configurable: false, enumerable: true, writable: false},
        "FRAGMENT_THRESHOLD": {configurable: false, enumerable: true, writable: false},
        "chunkBuffer": {configurable: false, enumerable: true, writable: false},
        "audioObject": {configurable: false, enumerable: true, writable: false},
        "events": {configurable: false, enumerable: true, writable: false}
    });

    if (this.debug) console.log(`STREAM: Controller created for new stream (ID: ${audioObject.ID}, SIZE: ${audioObject.SIZE} bytes, MIME_TYPE: ${audioObject.MIME_TYPE}, ENTRY POINT: ${this.STREAM_REQUEST_ENTRY_POINT})`);
    this.state = this.validStates.READY;
    
    return Object.seal(this);
};

// #EXTERNAL
StreamController.prototype.start = function() {
    if ([this.validStates.COMPLETED, this.validStates.ABORTED].includes(this.state))
        return false;

    if (this.debug) console.log(`STREAM: Opening stream (${this.STREAM_REQUEST_ENTRY_POINT})`);
    this.changeState(this.validStates.CONNECTING);

    const headers = new Headers();
    headers.append("Accept", this.audioObject.mimeType);

    const requestArguments = {
        method: "GET",
        cache: "no-store",
        mode: "cors",
        headers: headers,
        signal: this.abortController.signal
    };

    const request = new Request(`${this.STREAM_REQUEST_ENTRY_POINT}?fileName=${this.audioObject.ID}`, requestArguments);

    fetch(request).then((responseObject)=> {
        if (this.debug) console.log("STREAM: Connection opened, locking stream to reader");
        this.reader = responseObject.body.getReader();
        Object.defineProperty(this, "validStates", {configurable: false, enumerable: true, writable: false});
        this.read();
    })
    .catch((error)=> {
        console.warn("STREAM: Error when opening connection to stream:");
        this.stop(error.message);
    });
};

StreamController.prototype.read = function() {
    if ([this.validStates.COMPLETED, this.validStates.ABORTED].includes(this.state))
        return false;

    this.changeState(this.validStates.READING_FROM_STREAM);

    this.reader.read().then((result)=> {

        if (result.done) {
            this.changeState(this.validStates.COMPLETED);
            
            if (this.events.streamComplete) this.events.streamComplete();
            this.reader.cancel();

            if (this.calculateBufferedBytes() > 0) // Any remaining data in the buffer needs to be dealt with of course
                this.updateAudioObject(this.createFragment());

            if (this.debug) console.log("STREAM: Download complete, stream closed");
            return false;
        }

        this.onNextChunk(result.value);
    })
    .catch((error)=> {
        if (this.debug) console.error(error);
        this.stop(error.message);
    });
};

StreamController.prototype.onNextChunk = function(chunk) {
    
    this.chunkBuffer.add(chunk);
    let bufferedBytes = this.calculateBufferedBytes();
    
    if (bufferedBytes < this.FRAGMENT_THRESHOLD) {
        this.read();
        return;
    };

    this.changeState(this.validStates.UPDATING_AUDIO_OBJECT);
    this.updateAudioObject(this.createFragment());
};

StreamController.prototype.createFragment = function() {

    const bufferedBytes = this.calculateBufferedBytes();
    const fragment = new Uint8Array(bufferedBytes);

    let fragmentAppendOffset = 0;

    this.chunkBuffer.forEach((chunk) => {
        fragment.set(chunk, fragmentAppendOffset);
        fragmentAppendOffset = (fragmentAppendOffset + chunk.byteLength);
    });

    this.chunkBuffer.clear();
    return fragment;
};

StreamController.prototype.calculateBufferedBytes = function() {
    let totalSize = 0;
    this.chunkBuffer.forEach((chunk) => {
        totalSize += chunk.byteLength;
    })
    return totalSize;
};

StreamController.prototype.updateAudioObject = function(arrayBuffer) {
    if (!this.audioObject.addToBuffer) return; // Stream may have been cancelled while this was going on
    
    if (!this.audioObject.addToBuffer(arrayBuffer)) {
        this.stop();
        return;
    }

    if (!this.audioObject.getFragmentCount) return; // Stream may have been cancelled while this was going on
    if (this.events.fragmentAvailable) this.events.fragmentAvailable(this.audioObject.getFragmentCount() - 1);

    // INTERFACE UPDATE
    view.onInternalBufferUpdate();

    this.read();
};

// #EXTERNAL
StreamController.prototype.stop = function(reason) {
    if ([this.validStates.READY, this.validStates.COMPLETED, this.validStates.ABORTED].includes(this.state))
        return false;

    if (this.debug) console.warn(`STREAM: Aborting stream (${reason || "no reason given"})`);
    this.changeState(this.validStates.ABORTED);

    this.reader.cancel();
    this.abortController.abort();
    
    return true;
};

StreamController.prototype.changeState = function(newState) {
    if (!Object.values(this.validStates).includes(newState)) {
        console.error("STREAM: Can't change state. Argument is not a valid state: " + newState);
        return false;
    }

    this.state = newState;
    view.onStreamStateChange();
};

// Have to reconsider reversing this relationship so that the mediaController reads these values from the stream
StreamController.prototype.registerCallback = function(event, callback, context) {
    if (this.events[event])
        return false;

    this.events[event] = callback.bind(context);
};

StreamController.prototype.getStreamObject = function() {
    return this.audioObject || {};
};

StreamController.prototype.getState = function() {
    return this.state.description;
};