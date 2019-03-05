"use strict";

const StreamController = function() {

    // NOT_STARTED, IN_PROGRESS, ABORTED, COMPLETED
    this.state = "NOT_STARTED";
    this.THROTTLE = 0; // ms
    this.CHUNK_SIZE = 512 * 1000; // Kb
    this.STREAM_REQUEST_ENTRY_POINT = "GetAudio.cfm";
    this.stream = {}; // Instance of AudioStream
    this.abort = false;
    this.byteRequestOffset = 0;
    this.ABORT_CONTROLLER = new AbortController() || {ERROR: true};

    return Object.seal(this);
};

StreamController.prototype.getNextChunk = function() {

    if (this.stream.status.complete()) {
        this.state = "COMPLETED";
        console.log("AudioStream-object data streaming is done");
        return true;
    };

    if (this.abort) {
        console.warn("AudioStream-object data streaming aborted");
        return false;
    };

    console.log(`Fetching next data chunk (${this.stream.status.nextChunk + 1} out of ${this.stream.CHUNKS_EXPECTED})`);

    let nextChunkByteStart = (this.stream.status.nextChunk * this.CHUNK_SIZE) + this.byteRequestOffset;
    let nextChunkByteEnd = 0;

    if (this.stream.status.onLastChunk())
        nextChunkByteEnd = ""; // For the last chunk we just get whatever remains. If we fetch really tiny chunks we may not have enough valid frame data for the decoder
    else
        nextChunkByteEnd = nextChunkByteStart + this.CHUNK_SIZE;

    if ((isNaN(parseInt(nextChunkByteStart)) || parseInt(nextChunkByteStart) < 0) && !parseInt(nextChunkByteEnd)) {
        console.error("Can't fetch data chunk. nextChunkByteStart or nextChunkByteStart aren't valid");
        console.log(`${nextChunkByteStart} | ${nextChunkByteEnd}`);
        this.stop();
        return false;
    };

    console.log(`Initiate GET request to fetch byte ${nextChunkByteStart} to ${nextChunkByteEnd || this.stream.SIZE}`);

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

    window.fetch(request)
    .then((responseObject)=> {
        console.log("Data fetched, converting to arrayBuffer");
        return responseObject.arrayBuffer()
    })
    .then((decodedResponse)=> {
        console.log(`Data converted, updating stream object (byte length: ${decodedResponse.byteLength})`);
        this.update(decodedResponse)
    })
    .catch(function(error) {
        console.error(error);
        this.stop();
    });
};

StreamController.prototype.update = function(arrayBuffer) {
    if (arrayBuffer.constructor.name !== "ArrayBuffer") {
        console.error("Argument 'arrayBuffer' is not valid");
        this.stop();
        return false;
    };

    var audioDataDifference = 0;

    // Last chunk, no reason to check the difference
    if (!this.stream.status.onLastChunk())
        audioDataDifference = arrayBuffer.byteLength - this.CHUNK_SIZE;

    if (audioDataDifference > 0) {
        this.byteRequestOffset = (audioDataDifference + this.byteRequestOffset);
        console.warn(`Chunk data array is longer than expected by ${audioDataDifference} byte(s). Adjusting next chunk offset to ${this.byteRequestOffset} bytes`);
    };

    this.stream.CHUNKS.push(arrayBuffer);
    this.stream.status.lastUpdate = performance.now();
    if (!this.stream.status.onLastChunk())
        this.stream.status.nextChunk++;

    // INTERFACE UPDATE
    view.onInternalBufferUpdate();
    console.log("Chunk data array appended to stream's buffer");
    this.throttle();
};

StreamController.prototype.throttle = function() {
    const updated = performance.now();
    const updateDifference = updated - this.stream.status.lastUpdate;

    if (updateDifference < this.THROTTLE && !this.stream.status.onLastChunk()) {

        let throttleAmount = Math.floor(this.THROTTLE - updateDifference + 5);
        console.warn(`Stream was updated less than ${this.THROTTLE}ms ago (${Math.ceil(updateDifference)}ms). Throttling next request by ${throttleAmount}ms`);
        wait(throttleAmount).then(()=> this.throttle());

        return false;
    };

    this.getNextChunk();
};

StreamController.prototype.stop = function() {
    if (["NOT_STARTED","COMPLETED","ABORTED"].includes(this.state))
        return false;

    console.warn("Aborting stream");
    this.state = "ABORTED";
    this.ABORT_CONTROLLER.abort();
    
    return this;
};

StreamController.prototype.start = function() {
    if (["IN_PROGRESS","COMPLETED"].includes(this.state))
        return false;

    console.log(`Beginning to pump data into AudioStream-object | chunk size: ${this.CHUNK_SIZE} | chunks expected ${this.stream.CHUNKS_EXPECTED} | content size: ${this.stream.SIZE}`);
    
    this.state = "IN_PROGRESS";
    this.getNextChunk();

    return this;
};

StreamController.prototype.reset = function() {
    console.log("Resetting stream controller to its default state");

    this.stop();
    this.stream = {};
    this.state = "NOT_STARTED";
    this.abort = false;
    this.byteRequestOffset = 0;

    return this;
};

StreamController.prototype.load = function(id) {
    id = id || "ERROR";

    console.log(`Request received to prepare stream for ID '${id}'`);

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

        // INTERFACE UPDATE
        view.onNewStreamLoaded();
        console.log(`AudioStream with id '${id}' is ready to receive data`);
        this.start();

        mediaController.load(this.stream.METADATA.mimeType);

        return true;
    })
    .catch((error)=> console.error(error));
};