"use strict";

/* globals view wait AudioObject */

const StreamController = function(requestEntryPoint, desiredFragmentSize) {

    this.debug = true;

    this.validStates = Object.freeze({
        NOT_STARTED: Symbol("NOT_STARTED"),
        CONNECTING: Symbol("CONNECTING"),
        READY_TO_STREAM: Symbol("READY_TO_STREAM"),
        READING_FROM_STREAM: Symbol("READING_FROM_STREAM"),
        UPDATING_AUDIO_OBJECT: Symbol("UPDATING_AUDIO_OBJECT"),
        ABORTED: Symbol("ABORTED"),
        COMPLETED: Symbol("COMPLETED")
    });

    this.state = this.validStates.NOT_STARTED;
    this.STREAM_REQUEST_ENTRY_POINT = requestEntryPoint || "ERROR";
    this.abortController = new AbortController();
    this.mediaController = {}; // Instance of mediaController

    this.audioObject = {}; // Instance of AudioObject
    this.stream = {}; // Instance of ReadableStreamDefaultReader

    this.FRAGMENT_THRESHOLD = desiredFragmentSize || 512 * 1024; // Threshold at which existing chunks are combined (called a "fragment") and handed to the audio object
    this.chunkBuffer = new Set(); // Holds the chunks read from the stream, which gets purged every time the threshold is reached, and a fragment is created from the combined chunks available

    // Locking properties
    Object.defineProperties(this, {
        "validStates": {configurable: false, enumerable: true, writable: false},
        "STREAM_REQUEST_ENTRY_POINT": {configurable: false, enumerable: true, writable: false},
        "FRAGMENT_THRESHOLD": {configurable: false, enumerable: true, writable: false},
        "chunkBuffer": {configurable: false, enumerable: true, writable: false}
    });

    return Object.seal(this);
};

// #EXTERNAL
StreamController.prototype.start = function() {
    if ([this.validStates.NOT_STARTED, this.validStates.COMPLETED, this.validStates.ABORTED].includes(this.state))
        return;

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
        this.stream = responseObject.body.getReader();
        this.read();
    })
    .catch((error)=> {
        console.warn("STREAM: Error when opening connection to stream:");
        this.stop(error.message);
    });
};

StreamController.prototype.read = function() {
    if ([this.validStates.NOT_STARTED, this.validStates.COMPLETED, this.validStates.ABORTED].includes(this.state))
        return false;

    this.changeState(this.validStates.READING_FROM_STREAM);

    this.stream.read().then((result)=> {

        if (result.done) {
            this.changeState(this.validStates.COMPLETED);
            
            this.mediaController.status.streamComplete = true;
            this.stream.cancel();

            if (this.calculateBufferedBytes() > 0)
                this.updateAudioObject(this.createFragment());

            if (this.debug) console.log("STREAM: Download complete, stream closed");
            return;
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
    
    if (!this.audioObject.addToBuffer(arrayBuffer)) {
        this.stop();
        return;
    }

    this.audioObject.lastUpdate = performance.now();
    this.mediaController.status.nextAvailableDataChunk = this.audioObject.getFragmentCount() - 1;

    // INTERFACE UPDATE
    // view.onInternalBufferUpdate(); Again, do this with events

    this.read();
};

// #EXTERNAL
StreamController.prototype.stop = function(reason) {
    if ([this.validStates.NOT_STARTED, this.validStates.COMPLETED, this.validStates.ABORTED].includes(this.state))
        return;

    if (this.debug) console.warn(`STREAM: Aborting stream (${reason || "no reason given"})`);
    this.changeState(this.validStates.ABORTED);

    this.abortController.abort();
    this.stream.cancel();
    
    return true;
};

StreamController.prototype.reset = function() {
    if ([this.validStates.NOT_STARTED].includes(this.state))
        return;

    if (this.debug) console.log("STREAM: Resetting controller to its default state");

    this.stream = {};
    this.audioObject = {};
    this.abortController = new AbortController();

    this.changeState(this.validStates.NOT_STARTED);
};

// #EXTERNAL
StreamController.prototype.load = function(audioObject) {
    this.audioObject = (audioObject && audioObject instanceof AudioObject ? audioObject : "ERROR!");
    if (this.debug) console.log(`STREAM: Preparing for new stream (${this.audioObject.ID}, ${this.audioObject.SIZE} bytes, ${this.audioObject.MIME_TYPE})`);

    this.reset();
    this.changeState(this.validStates.READY_TO_STREAM);

    return true;
};

StreamController.prototype.changeState = function(newState) {
    if (!Object.values(this.validStates).includes(newState)) {
        console.error("STREAM: Can't change state. Argument is not a valid state: " + newState);
        return false;
    }

    this.state = newState;
    // view.onStreamStateChange();
};

StreamController.prototype.registerMediaController = function(self) {
    this.mediaController = (self && self instanceof MediaController ? self : "ERROR!");
    Object.defineProperty(this, "mediaController", {configurable: false, enumerable: true, writable: false});
};