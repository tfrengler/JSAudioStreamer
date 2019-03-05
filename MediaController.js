"use strict";

const MediaController = function() {

    // READY, BUFFERING, STALLED, WAITING, COMPLETED
    this.state = "READY";
    this.BUFFER_MAX_SIZE = 10485760 ; //bytes
    this.BUFFER_TRIM_INTERVAL = 30000; //ms;
    this.UPDATE_INTERVAL = 500; //ms
    this.AUDIO_FACADE = new Audio() || {ERROR: true};
    this.AUDIO_FACADE.setAttribute("preload", "metadata");

    this.MEDIA_SOURCE = new MediaSource() || {ERROR: true};
    this.MEDIA_SOURCE.addEventListener('sourceopen', ()=> console.log("Media source ready to receive buffers"));
    this.AUDIO_FACADE.src = URL.createObjectURL(this.MEDIA_SOURCE);

    this.status = Object.create(null);
    this.status.buffer = {};
    this.status.lastUpdate = 0;
    this.status.bufferedBytes = 0.0;
    this.status.bufferedDuration = 0.0;
    this.status.bufferedUntil = 0.0;
    this.status.nextDataChunk = 0;
    this.status.stalled = false;
    this.status.running = false;
    this.status.dataChunksExpected = 0;
    this.status.bufferLastTrimmed = 0;
    this.status.complete = function() {return this.nextDataChunk >= this.dataChunksExpected};

    // Event listeners
    this.AUDIO_FACADE.addEventListener("canplay", ()=> this.onPlayable());
    this.AUDIO_FACADE.addEventListener("error", ()=> this.onError());
    this.AUDIO_FACADE.addEventListener("stalled", ()=> this.onStalled());
    this.AUDIO_FACADE.addEventListener("ended", ()=> this.onPlaybackEnded());
    this.AUDIO_FACADE.addEventListener("timeupdate", ()=> this.onPlaybackTimeChanged());
    this.MEDIA_SOURCE.addEventListener("sourceended", ()=> this.onSourceClosed());

    document.querySelector("#mediaBufferSize").innerText = this.BUFFER_MAX_SIZE + " bytes";
    document.querySelector("#mediaBuffer").max = this.BUFFER_MAX_SIZE;
    document.querySelector("#mediaBuffer").high = (this.BUFFER_MAX_SIZE / 100) * 70;
    document.querySelector("#mediaBuffer").low = (this.BUFFER_MAX_SIZE / 100) * 30;

    Object.seal(this.status);
    return Object.freeze(this);
};

MediaController.prototype.onPlayable = function() {
    console.log("Enough data to play media");
    
    this.AUDIO_FACADE.play();
};

MediaController.prototype.onError = function(error) {
    console.error(error);
};

MediaController.prototype.onStalled = function() {
    console.warn("Playback has stalled");
    this.state = "STALLED";
};

MediaController.prototype.onPlaybackEnded = function() {
    console.log("Playback ended for current audio track");
};

MediaController.prototype.onSourceClosed = function() {
    console.warn("Media source closed. No more data can be appended to the buffer");
};

MediaController.prototype.onPlaybackTimeChanged = function() {
    if (performance.now() - this.status.lastPlaytimeUpdate < 1000)
        return;

    view.onPlaybackTimeChanged();
};

MediaController.prototype.reset = function() {

    view.onMediaBufferReset();

    this.status.lastUpdate = 0;
    this.status.bufferedBytes = 0.0;
    this.status.bufferedDuration = 0.0;
    this.status.bufferedUntil = 0.0;
    this.status.nextDataChunk = 0;
    this.status.stalled = false;
    this.status.dataChunksExpected = 0;

    if (this.status.buffer.constructor.name === "SourceBuffer")
        this.MEDIA_SOURCE.removeSourceBuffer(this.status.buffer);
    this.status.buffer = {};
    
    console.log("MediaController reset to default state");
};

MediaController.prototype.calculateBufferedDuration = function() {

    if (this.status.buffer.buffered.length === 0)
        return 0;

    var duration = 0;

    for (let i = 0; i < this.status.buffer.buffered.length; i++) {

        let start = this.status.buffer.buffered.start(i);
        let end = this.status.buffer.buffered.end(i);

        if (start > 0)
            duration = duration + (end - start);
        else
            duration = duration + end;
    };

    this.status.bufferedDuration = duration;
};

MediaController.prototype.calculateBufferedUntil = function() {
    if (this.status.buffer.buffered.length === 0)
        return 0;

    this.status.bufferedUntil = this.status.buffer.buffered.end(this.status.buffer.buffered.length - 1);
};

MediaController.prototype.onBufferUpdated = function() {
    console.log("Media buffer updated");

    this.calculateBufferedDuration();
    this.calculateBufferedUntil();
    view.onMediaBufferUpdate();

    this.updateAudioBuffer();
};

MediaController.prototype.load = function(mimeType) {

    if (!MediaSource.isTypeSupported(mimeType))
        return {NOT_SUPPORTED: mimeType || false};

    this.reset();
    this.status.dataChunksExpected = streamController.stream.CHUNKS_EXPECTED || null;
    this.status.buffer = this.MEDIA_SOURCE.addSourceBuffer(mimeType);
    this.status.buffer.addEventListener("update", ()=> this.onBufferUpdated());

    console.log(`MediaController initialized and ready to stream data (${mimeType})`);
    return true;
};

MediaController.prototype.updateAudioBuffer = function() {

    if (!this.status.running)
        return false;

    if (this.status.complete()) {

        if (this.status.buffer.updating) {
            console.warn("Buffer is locked, retrying in a moment...");
            wait(1000).then(()=> this.updateAudioBuffer());
            return;
        };

        console.log("Last data chunk appended, closing media buffer");
        this.MEDIA_SOURCE.endOfStream();
        return true;
    };

    console.log(`Updating audio buffer (chunk ${this.status.nextDataChunk + 1} out of ${this.status.dataChunksExpected})`);

    const updated = performance.now();
    const updateDifference = updated - this.status.lastUpdate;

    if (updateDifference < this.UPDATE_INTERVAL && !this.status.complete()) {
        console.warn(`Buffer updated less than ${this.UPDATE_INTERVAL}ms ago (${Math.ceil(updateDifference)}ms). Throttling`);

        wait(this.UPDATE_INTERVAL).then(()=> this.updateAudioBuffer());
        return false;
    };

    const dataChunk = streamController.stream.CHUNKS[this.status.nextDataChunk] || null;
    if (!dataChunk) {
        console.warn("Next data chunk isn't available. Media buffering has stalled");
        this.status.stalled = true;
        return false;
    };

    const bufferOverflow = (this.status.bufferedBytes + dataChunk.byteLength) > this.BUFFER_MAX_SIZE;

    if ( bufferOverflow ) {
        let bufferOverflowAmount = (this.status.bufferedBytes + dataChunk.byteLength) - this.BUFFER_MAX_SIZE;
        console.warn(`Next data chunk would overflow the media buffer by ${Math.round(bufferOverflowAmount)} bytes. Need to trim the buffer`);
        this.handleBufferOverflow();
        return false;
    };

    console.log(`Appending data chunk ${this.status.nextDataChunk + 1} to media buffer (${dataChunk.byteLength})`);
    this.status.buffer.appendBuffer(dataChunk);
    
    this.status.nextDataChunk++;
    this.status.bufferedBytes = this.status.bufferedBytes + dataChunk.byteLength;
    this.status.lastUpdate = performance.now();

    return true;
};

MediaController.prototype.handleBufferOverflow = function() {

    const playCursor = this.AUDIO_FACADE.currentTime;
    var milisecondsBeforeRetry = 0;
    const minSecondsBeforeRemove = 30;
    const lastUpdateDifference = performance.now() - this.status.bufferLastTrimmed;

    if (playCursor < minSecondsBeforeRemove || lastUpdateDifference < this.BUFFER_TRIM_INTERVAL) {
        milisecondsBeforeRetry = this.BUFFER_TRIM_INTERVAL;

        console.warn(`Cannot trim the buffer yet. The media's current playtime is either less than ${minSecondsBeforeRemove} seconds, or it's been less than ${this.BUFFER_TRIM_INTERVAL}ms since last time we trimmed (${lastUpdateDifference}). Trying again later (${milisecondsBeforeRetry}ms)`);
        wait(milisecondsBeforeRetry).then(()=> this.handleBufferOverflow());
        
        return false;
    };

    const secondToRemoveStart = 0;
    const secondToRemoveEnd = playCursor - 5;
    const bytesToRemoveFromBuffer = streamController.stream.BYTES_PER_SECOND * (secondToRemoveStart + secondToRemoveEnd);

    this.trimBuffer(secondToRemoveStart, secondToRemoveEnd, bytesToRemoveFromBuffer);
};

MediaController.prototype.trimBuffer = function(start, end, bytes) {

    console.log(`Attempting to remove ${Math.round(start + end)} seconds of data from the media buffer (roughly ${Math.round(bytes)} bytes)`);

    if (this.status.buffer.updating) {
        console.warn("Buffer is locked, retrying in a moment...");
        
        wait(1000).then(function() {this.trimBuffer(start, end, bytes)});
        return;
    };

    this.status.bufferedBytes = this.status.bufferedBytes - bytes;
    this.status.buffer.remove(start, end);
    this.status.bufferLastTrimmed = performance.now();
    view.onMediaBufferUpdate();
};

MediaController.prototype.play = function() {
    console.log("Starting playback and media buffering");

    // if (!this.status.running && !this.status.stalled)
    //     this.AUDIO_FACADE.play();

    this.status.running = true;
    this.updateAudioBuffer();
};

MediaController.prototype.stop = function() {
    console.log("Stopping playback and media buffering");

    this.AUDIO_FACADE.pause();
    this.status.running = false;
};