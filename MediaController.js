"use strict";

const MediaController = function() {
    
    this.BUFFER_MAX_SIZE = 10485760 ; //bytes
    this.BUFFER_BUFFER_UPDATE_INTERVAL = 1000; //ms
    this.BUFFER_LOCK_RETRY = 1000; //ms
    this.BUFFER_AHEAD_THRESHOLD = 10; //seconds
    this.BUFFER_AHEAD = 60; //seconds
    this.BUFFER_TRIM_SECONDS = 60; //seconds
    this.AUDIO_FACADE = new Audio() || {ERROR: true};
    this.AUDIO_FACADE.setAttribute("preload", "metadata");

    this.MEDIA_SOURCE = new MediaSource() || {ERROR: true};
    this.MEDIA_SOURCE.addEventListener('sourceopen', ()=> console.log("MEDIA: Source ready to receive buffers"));
    this.AUDIO_FACADE.src = URL.createObjectURL(this.MEDIA_SOURCE);

    this.status = Object.create(null);
    // READY, BUFFERING, STALLED, WAITING, COMPLETED
    this.status.state = "READY";
    this.status.buffer = {};
    this.status.lastUpdate = 0; //performance.now() timestamp
    this.status.bufferedBytes = 0.0;
    this.status.bufferedDuration = 0.0; //Seconds
    this.status.bufferedUntil = 0.0; //Seconds
    this.status.nextDataChunk = 0;
    this.status.dataChunksExpected = 0;
    this.status.bufferStrategy = "";
    this.status.lastPlaytimeUpdate = 0.0; //performance.now() timestamp
    this.status.bufferingAhead = false;
    this.status.bufferAheadMark= 0.0; //Seconds, corresponding to timestamp from the audio track's duration
    this.status.bufferBeingTrimmed = false;
    this.status.bufferLastTrimmed = 0.0; //Seconds, corresponding to timestamp from the audio track's duration
    this.status.complete = function() {return this.nextDataChunk >= this.dataChunksExpected};

    // Event listeners
    this.AUDIO_FACADE.addEventListener("durationchange", ()=> this.onDurationChange());
    this.AUDIO_FACADE.addEventListener("pause", ()=> this.onPause());
    this.AUDIO_FACADE.addEventListener("canplay", ()=> this.onPlayable());
    this.AUDIO_FACADE.addEventListener("error", ()=> this.onError());
    this.AUDIO_FACADE.addEventListener("stalled", ()=> this.onStalled());
    this.AUDIO_FACADE.addEventListener("ended", ()=> this.onPlaybackEnded());
    this.AUDIO_FACADE.addEventListener("timeupdate", ()=> this.onPlaybackTimeChanged());
    this.MEDIA_SOURCE.addEventListener("sourceended", ()=> this.onSourceClosed());

    Object.seal(this.status);
    return Object.freeze(this);
};

MediaController.prototype.onDurationChange = function() {
    console.log(`MEDIA: Duration of audio track updated (${this.AUDIO_FACADE.duration})`);
};

MediaController.prototype.onPause = function() {
    console.log("MEDIA: Playback paused");
};

MediaController.prototype.onPlayable = function() {
    console.log("MEDIA: Enough data to play media");
    this.AUDIO_FACADE.play();
};

MediaController.prototype.onError = function(error) {
    console.error(error);
};

MediaController.prototype.onStalled = function() {
    console.warn("MEDIA: Playback/buffering has stalled");
    this.changeState("STALLED");
    this.status.bufferingAhead = false;
    streamController.notifyOnChunkAvailability = true;
};

MediaController.prototype.onPlaybackEnded = function() {
    console.log("MEDIA: Playback ended for current audio track");
};

MediaController.prototype.onSourceClosed = function() {
    console.warn("MEDIA: Source closed. No more buffers can be created and no more data can be appended");
};

MediaController.prototype.onPlaybackTimeChanged = function() {
    if (performance.now() - this.status.lastPlaytimeUpdate < 1000)
        return;

    this.status.lastPlaytimeUpdate = performance.now();
    view.onPlaybackTimeChanged();

    if (this.status.appending === true) {
        this.bufferUntil();
        return;
    };

    if (this.status.bufferStrategy === "INCREMENT" && (this.status.state !== "STALLED" && this.status.state !== "COMPLETED"))
        this.bufferIncrementally();
};

MediaController.prototype.reset = function() {

    view.onMediaBufferReset();

    this.status.state = "RESET";
    this.status.lastUpdate = 0;
    this.status.bufferedBytes = 0.0;
    this.status.bufferedDuration = 0.0;
    this.status.bufferedUntil = 0.0;
    this.status.nextDataChunk = 0;
    this.status.dataChunksExpected = 0;
    this.status.bufferStrategy = "";
    this.status.lastPlaytimeUpdate = 0.0;
    this.status.bufferingAhead = false;
    this.status.bufferAheadMark = 0.0;
    this.status.bufferBeingTrimmed = false;
    this.status.bufferLastTrimmed = 0;

    if (this.status.buffer.constructor.name === "SourceBuffer")
        this.MEDIA_SOURCE.removeSourceBuffer(this.status.buffer);
    this.status.buffer = {};
    
    console.log("MEDIA: Controller reset to default state");
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
    // Challenge here is that the update-event is fired for append, remove and - apparently, surprisingly - also on duration changes 
    console.log("MEDIA: Buffer updated (append, remove, etc)");

    this.calculateBufferedDuration();
    this.calculateBufferedUntil();
    view.onMediaBufferUpdate();

    if (this.status.bufferBeingTrimmed === true) {
        console.warn("MEDIA: Buffer update triggered by trimming");
        this.status.bufferBeingTrimmed = false;
        return;
    };

    if (this.status.bufferStrategy === "FILL" && (this.status.state !== "STALLED" && this.status.state !== "COMPLETED")) {
        this.bufferFully();
        return;
    };

    if  (this.status.bufferStrategy === "INCREMENT" && 
        (this.status.state !== "STALLED" && this.status.state !== "COMPLETED") &&
        this.status.bufferingAhead === true)
            this.bufferAhead();

};

MediaController.prototype.load = function(mimeType) {
    // If mimetype isn't supported, there's no need to go any further
    if (!MediaSource.isTypeSupported(mimeType))
        return {NOT_SUPPORTED: mimeType || false};

    this.reset();
    this.status.dataChunksExpected = streamController.stream.CHUNKS_EXPECTED || null;
    // We need to rewrite this to create a new MediaSource, because when it's closed (.endofstream()), you can't re-open it
    this.status.buffer = this.MEDIA_SOURCE.addSourceBuffer(mimeType);
    view.onMediaMimetypeKnown(mimeType);

    this.MEDIA_SOURCE.duration = streamController.stream.METADATA.length;
    this.status.buffer.addEventListener("update", ()=> this.onBufferUpdated());
    this.changeState("READY");

    console.log(`MEDIA: Controller initialized and ready to stream data (${mimeType})`);
    return true;
};

MediaController.prototype.updateAudioBuffer = function() {
    console.log(`MEDIA: Updating buffer (chunk ${this.status.nextDataChunk + 1} out of ${this.status.dataChunksExpected})`);

    if (this.status.buffer.updating) {
        console.warn("MEDIA: Buffer is locked, retrying in a moment");
        
        wait(this.BUFFER_LOCK_RETRY).then(()=> this.updateAudioBuffer());
        return;
    };

    const dataChunk = streamController.stream.CHUNKS[this.status.nextDataChunk] || null;

    if (!dataChunk) {
        console.warn("MEDIA: Next data chunk isn't available. Buffering has stalled");
        this.onStalled();
        return false;
    };

    console.log(`MEDIA: Appending data chunk to buffer (${dataChunk.byteLength} bytes)`);

    this.status.nextDataChunk++;
    this.status.bufferedBytes = this.status.bufferedBytes + dataChunk.byteLength;
    this.status.buffer.appendBuffer(dataChunk);
    this.status.lastUpdate = performance.now();

    return true;
};

MediaController.prototype.trimBuffer = function(start, end) {

    if (this.status.buffer.updating) {
        console.warn("MEDIA: Buffer is locked, retrying in a second");
        
        wait(this.BUFFER_LOCK_RETRY).then(()=> this.trimBuffer(start, end, bytes));
        return;
    };

    const removeDuration = end - start;
    const bytesRemoved = streamController.stream.BYTES_PER_SECOND * removeDuration;

    this.status.bufferedBytes = this.status.bufferedBytes - bytesRemoved;
    console.log(`MEDIA: Attempting to remove ${Math.round(removeDuration)} seconds of data from the buffer (est. ${Math.round(bytesRemoved)} bytes)`);
    
    this.status.buffer.remove(start, end);
    this.status.bufferBeingTrimmed = true;
    this.status.bufferLastTrimmed = this.AUDIO_FACADE.currentTime;
};

MediaController.prototype.play = function() {
    if (this.status.state !== "READY" && this.AUDIO_FACADE.paused) {
        this.AUDIO_FACADE.play();
        return;
    };

    console.log("MEDIA: Starting playback and audio data buffering");
    this.prepare();
};

MediaController.prototype.stop = function() {
    console.log("MEDIA: Stopping playback");
    this.AUDIO_FACADE.pause();
};

MediaController.prototype.prepare = function() {

    if (streamController.stream.SIZE < this.BUFFER_MAX_SIZE) {
        console.log(`MEDIA: Audio data is less than our buffer size (${streamController.stream.SIZE}), buffering fully`);
        this.status.bufferStrategy = "FILL";
        view.onMediaBufferStrategyKnown();
        this.bufferFully();
    }
    else {
        console.log(`MEDIA: Audio data is bigger than our buffer size (${streamController.stream.SIZE}), buffering incrementally`);
        this.status.bufferStrategy = "INCREMENT";
        view.onMediaBufferStrategyKnown();
        this.bufferIncrementally();
    };

};

MediaController.prototype.bufferFully = function() {

    if (this.status.complete()) {
        console.log("MEDIA: Buffer has been filled");
        this.closeStream();
        return true;
    };

    const lastUpdateDifference = performance.now() - this.status.lastUpdate;

    if (lastUpdateDifference < this.BUFFER_UPDATE_INTERVAL) {
        console.warn(`MEDIA: Buffer updated less than ${this.BUFFER_UPDATE_INTERVAL}ms ago (${Math.round(lastUpdateDifference)}ms). Throttling`);
        this.changeState("WAITING");
        wait(this.BUFFER_UPDATE_INTERVAL + 5).then(()=> this.bufferFully());
        return false;
    };

    this.changeState("BUFFERING");
    this.updateAudioBuffer();
};

MediaController.prototype.bufferIncrementally = function() {

    // At this point the buffering is controlled by the sourceBuffer update-event
    if (this.status.bufferingAhead)
        return;

    if (this.status.complete()) {
        console.log("MEDIA: Buffer has been filled");
        this.closeStream();
        return true;
    };

    const playCursor = this.AUDIO_FACADE.currentTime;
    const timeDifference = this.status.bufferedUntil - playCursor;

    if (timeDifference < this.BUFFER_AHEAD_THRESHOLD) {
        console.warn(`MEDIA: Less than ${this.BUFFER_AHEAD_THRESHOLD} playable seconds in buffer`);

        if (playCursor - this.status.bufferLastTrimmed > this.BUFFER_TRIM_SECONDS) {
            console.warn(`MEDIA: More than ${this.BUFFER_TRIM_SECONDS} seconds trail in buffer, trimming first`);
            this.trimBuffer(this.status.buffer.buffered.start(0), playCursor - 5);
            return;
        };

        this.changeState("BUFFERING");
        console.log(`MEDIA: Buffering audio data`);
        
        this.status.bufferAheadMark = this.AUDIO_FACADE.currentTime;
        this.status.bufferingAhead = true;
        this.bufferAhead();

        return true;
    };

    console.log(`MEDIA: Enough data in buffer, waiting`);
    this.changeState("WAITING");
};

MediaController.prototype.closeStream = function() {

    if (this.status.buffer.updating) {
        console.warn("MEDIA: Buffer is locked, retrying in a moment");
        wait(this.BUFFER_LOCK_RETRY).then(()=> this.closeStream());
        return;
    };

    if (this.MEDIA_SOURCE.readyState === "open") {
        console.log("MEDIA: Closing buffer");
        this.MEDIA_SOURCE.endOfStream();
        this.changeState("COMPLETED");
    };

    return true;
};

MediaController.prototype.nextChunkIsAvailable = function() {

    if (this.status.bufferStrategy === "FILL") {
        this.bufferFully();
        return;
    };

    this.bufferIncrementally();
};

MediaController.prototype.bufferAhead = function() {

    if (this.status.complete()) {
        console.log("MEDIA: Buffer has been filled");
        this.closeStream();
        return true;
    };

    if (this.status.bufferedUntil - this.status.bufferAheadMark > this.BUFFER_AHEAD) {
        console.log(`MEDIA: Buffered enough data ahead (${this.BUFFER_AHEAD})`);
        this.status.bufferingAhead = false;
        return true;
    };

    this.updateAudioBuffer();
};

MediaController.prototype.changeState = function(newState) {
    this.status.state = newState;
    view.onMediaStateChange();
};