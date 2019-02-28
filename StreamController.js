const StreamController = function() {

    // NOT_STARTED, IN_PROGRESS, ABORTED, COMPLETED
    this.state = "NOT_STARTED";
    this.THROTTLE = 2000; // ms
    this.CHUNK_SIZE = 512 * 1000; // Kb
    this.STREAM_REQUEST_ENTRY_POINT = "GetAudioMetadata.cfm";
    this.stream = {};
    this.abort = false;
    this.byteRequestOffset = 0;
    this.abortControl = new AbortController();

};

StreamController.prototype.wait = function(ms) {
    return new Promise((resolve, reject)=> setTimeout(resolve, parseFloat(ms) || 0));
};

StreamController.prototype.getNextChunk = function() {

    if (this.stream.complete()) {
        this.state = "COMPLETED";
        return true;
    };

    if (this.abort) {
        return false;
    };

    let nextChunkByteStart = (this.status.currentChunk * CHUNK_SIZE) + this.byteRequestOffset;
    let nextChunkByteEnd = 0;

    if (this.stream.status.nextChunk === (this.stream.chunksExpected - 1))
        nextChunkByteEnd = ""; // For the last chunk we just get whatever remains. If we fetch really tiny chunks we may not have enough valid frame data for the decoder
    else
        nextChunkByteEnd = nextChunkByteStart + CHUNK_SIZE;

    if ((isNaN(parseInt(nextChunkByteStart)) || parseInt(nextChunkByteStart) < 0) && !parseInt(nextChunkByteEnd)) {
        console.error("Can't fetch data chunk. nextChunkByteStart or nextChunkByteStart aren't valid");
        console.log(`${nextChunkByteStart} | ${nextChunkByteEnd}`);
        this.stop();
        return false;
    };

    const headers = new Headers();
    // Get accept from mime-type in audio stream metadata?
    headers.append("Accept", "audio/mpeg");
    headers.append("range", `bytes=${nextChunkByteStart}-${nextChunkByteStart}`);

    const requestArguments = {
        method: "GET",
        cache: "no-store",
        mode: "cors",
        headers: headers,
        signal: this.abortControl.signal
    };

    const request = new Request(this.STREAM_REQUEST_ENTRY_POINT, requestArguments);

    window.fetch(request)
    .then((responseObject)=> responseObject.arrayBuffer())
    .then((decodedResponse)=> this.update(decodedResponse))
    .catch(function(error) {
        console.error(error);
        this.stop();
    });
};

StreamController.prototype.update = function(arrayBuffer) {
    let audioDataOffset = arrayBuffer.byteLength - this.CHUNK_SIZE;
    this.byteRequestOffset = (audioDataOffset + requestByteOffset);

    this.stream.CHUNKS.push(arrayBuffer);
    this.stream.status.lastUpdate = performance.now();

    this.throttle();
};

StreamController.prototype.throttle = function() {
    let updated = performance.now();
    let updateDifference = updated - this.stream.status.lastUpdate;

    if (updateDifference < this.THROTTLE) {
        wait(this.THROTTLE).then(function() { this.throttle() });
        return;
    };

    this.getNextChunk()
};

StreamController.prototype.stop = function() {
    if (["NOT_STARTED","COMPLETED","ABORTED"].includes(this.state))
        return;

    this.state = "ABORTED";
    this.abortControl.abort();
    this.abortFetch();
};

StreamController.prototype.start = function() {
    if (["IN_PROGRESS","COMPLETED"].includes(this.state))
        return;
    
    this.state = "IN_PROGRESS";
    this.getNextChunk();
};