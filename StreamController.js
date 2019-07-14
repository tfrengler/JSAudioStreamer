"use strict";

/* globals view wait AudioStream mediaController */

const StreamController = function() {

    this.VALID_STATES = Object.freeze({
        NOT_STARTED: Symbol("NOT STARTED"),
        FETCHING: Symbol("FETCHING"),
        WAITING: Symbol("WAITING"),
        ABORTED: Symbol("ABORTED"),
        COMPLETED: Symbol("COMPLETED")
    });
    
    this.THROTTLE = 0; // ms
    this.CHUNK_SIZE = 512 * 1000; // Kb
    this.STREAM_REQUEST_ENTRY_POINT = "GetAudio.cfm";
    this.ABORT_CONTROLLER = new AbortController();

    this.state = this.VALID_STATES.NOT_STARTED;
    this.stream = {}; // Instance of AudioStream
    this.byteRequestOffset = 0;
    this.notifyOnChunkAvailability = false;

    return Object.seal(this);
};

StreamController.prototype.getNextChunk = function() {

    if (this.stream.status.complete()) {
        this.changeState(this.VALID_STATES.COMPLETED);
        console.log("STREAM: Data streaming is done, AudioStream is full");
        return true;
    }

    if (this.state === this.VALID_STATES.ABORTED) {
        console.warn("STREAM: Data streaming aborted!");
        return false;
    }

    console.log(`STREAM: Remotely fetching data chunk (${this.stream.status.nextChunk + 1} out of ${this.stream.CHUNKS_EXPECTED})`);

    let nextChunkByteStart = (this.stream.status.nextChunk * this.CHUNK_SIZE) + this.byteRequestOffset;
    let nextChunkByteEnd = 0;

    if (this.stream.status.onLastChunk())
        nextChunkByteEnd = ""; // For the last chunk we just get whatever remains. If we fetch really tiny chunks we may not have enough valid frame data for the decoder
    else
        nextChunkByteEnd = nextChunkByteStart + this.CHUNK_SIZE;

    if ((isNaN(parseInt(nextChunkByteStart)) || parseInt(nextChunkByteStart) < 0) && !parseInt(nextChunkByteEnd)) {
        console.error("STREAM: Can't fetch data chunk. nextChunkByteStart or nextChunkByteStart aren't valid");
        console.warn(`${nextChunkByteStart} | ${nextChunkByteEnd}`);
        this.stop();
        return false;
    }

    console.log(`STREAM: Initiate GET request to fetch byte ${nextChunkByteStart} to ${nextChunkByteEnd || this.stream.SIZE}`);

    const headers = new Headers();
    headers.append("Accept", this.stream.METADATA.mimeType);
    headers.append("range", `bytes=${nextChunkByteStart}-${nextChunkByteEnd}`);

    const requestArguments = {
        method: "GET",
        cache: "no-store",
        mode: "cors",
        headers: headers,
        signal: this.ABORT_CONTROLLER.signal
    };

    const request = new Request(`${this.STREAM_REQUEST_ENTRY_POINT}?fileName=${this.stream.ID}`, requestArguments);
    this.changeState(this.VALID_STATES.FETCHING);

    window.fetch(request)
    .then((responseObject)=> {
        console.log("STREAM: Audio data fetched, converting to arrayBuffer");
        return responseObject.arrayBuffer()
    })
    .then((decodedResponse)=> {
        console.log(`STREAM: Audio data converted, updating AudioStream (byte length: ${decodedResponse.byteLength})`);
        this.update(decodedResponse)
    })
    .catch((error)=> {
        console.log(error);
        this.stop();
    });
};

StreamController.prototype.update = function(arrayBuffer) {

    if (arrayBuffer.constructor.name !== "ArrayBuffer") {
        console.error("Argument 'arrayBuffer' is not valid");
        this.stop();
        return false;
    }

    var audioDataDifference = 0;

    // Last chunk, no reason to check the difference
    if (!this.stream.status.onLastChunk())
        audioDataDifference = arrayBuffer.byteLength - this.CHUNK_SIZE;

    if (audioDataDifference > 0) {
        this.byteRequestOffset = (audioDataDifference + this.byteRequestOffset);
        console.warn(`Chunk data array is longer than expected by ${audioDataDifference} byte(s). Adjusting next chunk offset to ${this.byteRequestOffset} bytes`);
    }

    this.stream.CHUNKS.push(arrayBuffer);
    if (this.notifyOnChunkAvailability === true)
        this.notifyMediaController();

    this.stream.status.lastUpdate = performance.now();
    if (!this.stream.status.onLastChunk())
        this.stream.status.nextChunk++;

    // INTERFACE UPDATE
    view.onInternalBufferUpdate();
    console.log("STREAM: Audio data array appended to buffer");
    this.throttle();
};

StreamController.prototype.throttle = function() {
    const updated = performance.now();
    const updateDifference = updated - this.stream.status.lastUpdate;

    if (updateDifference < this.THROTTLE && !this.stream.status.onLastChunk()) {

        this.changeState(this.VALID_STATES.WAITING);

        let throttleAmount = Math.floor(this.THROTTLE - updateDifference + 5);
        console.warn(`Stream was updated less than ${this.THROTTLE}ms ago (${Math.ceil(updateDifference)}ms). Throttling next request by ${throttleAmount}ms`);
        wait(throttleAmount).then(()=> this.throttle());

        return false;
    }

    this.getNextChunk();
};

StreamController.prototype.stop = function() {
    if ([this.VALID_STATES.COMPLETED, this.VALID_STATES.ABORTED, this.VALID_STATES.NOT_STARTED].includes(this.state))
        return false;

    console.warn("Aborting stream");
    this.changeState(this.VALID_STATES.ABORTED);
    this.ABORT_CONTROLLER.abort();
    // Apparently we need to create a new one because the old will remain in an aborted state and cannot be changed
    this.ABORT_CONTROLLER = new AbortController();
    
    return false;
};

StreamController.prototype.start = function() {
    if ([this.VALID_STATES.FETCHING, this.VALID_STATES.WAITING].includes(this.state))
        return false;

    console.log(`STREAM: Pumping data into AudioStream-object | chunk size: ${this.CHUNK_SIZE} | chunks expected ${this.stream.CHUNKS_EXPECTED} | content size: ${this.stream.SIZE}`);
    this.getNextChunk();

    return this;
};

StreamController.prototype.reset = function() {
    console.log("STREAM: Resetting controller to its default state");

    this.stop();
    this.stream = {};
    this.changeState(this.VALID_STATES.NOT_STARTED);
    this.byteRequestOffset = 0;

    return this;
};

StreamController.prototype.load = function(id) {
    id = id || "ERROR";

    console.log(`STREAM: Request received to prepare stream for ID '${id}'`);

    const headers = new Headers();
    headers.append("Accept", "application/json");

    const requestArguments = {
        method: "GET",
        cache: "no-store",
        mode: "cors",
        headers: headers
    };

    const request = new Request(`GetAudioMetadata.cfm?fileName=${encodeURIComponent(id)}`, requestArguments);

    return window.fetch(request)
    .then((responseObject)=> responseObject.json())
    .then((decodedResponse)=> {

        this.reset();
        this.stream = new AudioStream(decodedResponse, this.CHUNK_SIZE, id);

        if (!mediaController.load(this.stream.METADATA.mimeType)) {
            window.alert(`Sorry, your browser does not supported decoding of this media type (${this.stream.METADATA.mimeType})`);
            return false;
        }

        // INTERFACE UPDATE
        view.onNewStreamLoaded();
        console.log(`STREAM: AudioStream with id '${id}' is ready to receive data`);
        this.start();

        return true;
    })
    .catch((error)=> console.error(error));
};

StreamController.prototype.notifyMediaController = function() {
    mediaController.nextChunkIsAvailable();
    this.notifyOnChunkAvailability = false;
};

StreamController.prototype.changeState = function(newState) {

    if (!Object.values(this.VALID_STATES).includes(newState)) {
        console.error("STREAM: Can't change state. Argument is not a valid state: " + newState);
        return false;
    }

    this.state = newState;
    view.onStreamStateChange();
};