"use strict";

/* globals view StreamController streamController wait */

const MediaController = function(streamController) { // eslint-disable-line no-unused-vars

    this.debug = true;

    this.validStates = Object.freeze({
        IDLE: Symbol("IDLE"),
        INITIALIZING: Symbol("INITIALIZING"),
        READY_TO_PLAY: Symbol("READY TO PLAY"),
        BUFFERING: Symbol("BUFFERING"),
        STALLED: Symbol("STALLED"),
        HAS_ENOUGH_DATA: Symbol("PAUSED, HAS ENOUGH DATA"),
        WAITING_FOR_DATA: Symbol("WAITING FOR DATA"),
        COMPLETED: Symbol("COMPLETED"),
        RESET: Symbol("RESET"),
        STOPPING: Symbol("STOPPING")
    });

    this.bufferStrategies = Object.freeze({
        INCREMENT: Symbol("INCREMENT"),
        FILL: Symbol("FILL")
    });

    if (streamController && streamController instanceof StreamController) {
        this.streamController = streamController;
        this.streamController.registerMediaController(this);
    }
    else
        this.streamController = "ERROR!";
    
    this.BUFFER_MAX_SIZE = 10 * 1024 * 1024 ; // The size of the audio buffer in bytes. Lowest observed is 12MB for Firefox
    this.BUFFER_LOCK_RETRY = 1000; // How many ms to retry updating the buffer if it was locked
    this.BUFFER_AHEAD_THRESHOLD = 10; // When the play cursor gets below this threshold, buffer more audio
    this.BUFFER_AHEAD = 60; // How many seconds of audio is buffered ahead
    this.BUFFER_TRIM_SECONDS = 60; // How many seconds of audio is kept behind the current play position
    this.BUFFER_UPDATE_INTERVAL = 2000 // ms
    this.CHUNK_NOT_AVAILABLE_RETRY = 2000 // How many ms to wait to try again if the next audio data chunk isn't available
    this.audioController = new Audio(); //document.getElementsByTagName("audio")[0]
    
    this.audioController.setAttribute("preload", "metadata");
    this.audioController.autoplay = false;

    this.status = {}; // Instance of StatusTracker

    // Locking properties
    Object.defineProperties(this, {
        validStates: {configurable: false, enumerable: true, writable: false},
        bufferStrategies: {configurable: false, enumerable: true, writable: false},
        BUFFER_MAX_SIZE: {configurable: false, enumerable: true, writable: false},
        BUFFER_LOCK_RETRY: {configurable: false, enumerable: true, writable: false},
        BUFFER_AHEAD_THRESHOLD: {configurable: false, enumerable: true, writable: false},
        BUFFER_AHEAD: {configurable: false, enumerable: true, writable: false},
        BUFFER_TRIM_SECONDS: {configurable: false, enumerable: true, writable: false},
        audioController: {configurable: false, enumerable: true, writable: false},
        streamController: {configurable: false, enumerable: true, writable: false},
        CHUNK_NOT_AVAILABLE_RETRY: {configurable: false, enumerable: true, writable: false}
    });

    // Event listeners
    this.audioController.addEventListener("durationchange", ()=> this.onDurationChange());
    this.audioController.addEventListener("pause", ()=> this.onPause());
    this.audioController.addEventListener("canplay", ()=> this.onPlayable());
    this.audioController.addEventListener("error", ()=> this.onError());
    this.audioController.addEventListener("stalled", ()=> this.onStalled());
    this.audioController.addEventListener("waiting", ()=> this.onStalled());
    this.audioController.addEventListener("ended", ()=> this.onPlaybackEnded());
    this.audioController.addEventListener("timeupdate", ()=> this.onPlaybackTimeChanged());

    return Object.seal(this);
};

// EVENT HANDLERS
MediaController.prototype.onDurationChange = function() {
    if (this.debug) console.log(`MEDIA: Duration of audio track updated (${this.audioController.duration})`);
};

MediaController.prototype.onPause = function() {
    if (this.debug) console.log("MEDIA: Playback paused");
};

MediaController.prototype.onPlayable = function() {
    if (this.debug) console.log("MEDIA: Enough data to play media");
    if (this.status.playWhenDataAvailable) this.audioController.play();
};

MediaController.prototype.onError = function(error) {
    console.error(error);
};

MediaController.prototype.onStalled = function() {
    if (this.debug) console.warn("MEDIA: Playback/buffering has stalled, due to lack of data");
    this.status.playWhenDataAvailable = true;
    this.changeState(this.validStates.STALLED);
};

MediaController.prototype.onPlaybackEnded = function() {
    if (this.debug) console.log("MEDIA: Playback ended for current audio track");
};

MediaController.prototype.onSourceClosed = function() {
    if (this.debug) console.log("MEDIA: Source closed. No more audio data can be appended");
};

MediaController.prototype.onPlaybackTimeChanged = function() {
    // Have to make this less than 1 second otherwise we start skipping seconds in the interface
    if (performance.now() - this.status.lastPlaytimeUpdate < 900)
        return;

    this.status.lastPlaytimeUpdate = performance.now();
    view.onPlaybackTimeChanged();

    if (
            this.status.bufferStrategy === this.bufferStrategies.INCREMENT && 
            (this.status.state !== this.validStates.STALLED && this.status.state !== this.validStates.COMPLETED)
        )
        this.bufferIncrementally();
};

MediaController.prototype.onBufferUpdated = function() {

    this.calculateBufferedDuration();
    this.calculateBufferedUntil();
    view.onMediaBufferUpdate();

    if (this.status.bufferBeingTrimmed === true) {
        console.log("MEDIA: Audio buffer has been trimmed");
        this.status.bufferBeingTrimmed = false;
        return;
    }

    // Challenge here is that the update-event is fired for append, remove and - surprisingly - also on duration changes...
    if (this.debug) console.log("MEDIA: Audio buffer updated");

    if (
        this.status.bufferStrategy === this.bufferStrategies.FILL &&
        (this.status.state !== this.validStates.STALLED && this.status.state !== this.validStates.COMPLETED)
        ) 
    {
        this.bufferFully();
        return;
    }

    if  (
            this.status.bufferStrategy === this.bufferStrategies.INCREMENT && 
            (this.status.state !== this.validStates.STALLED && this.status.state !== this.validStates.COMPLETED) &&
            this.status.bufferingAhead === true
        )
            this.bufferAhead();

};

// METHODS
MediaController.prototype.reset = function() {
    view.onMediaBufferReset();

    URL.revokeObjectURL(this.audioController.src);
    this.status = new this.StatusTracker(this.validStates.RESET);

    if (this.debug) console.log("MEDIA: Controller has been reset to default state");
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
    }

    this.status.bufferedDuration = duration;
};

MediaController.prototype.calculateBufferedUntil = function() {
    if (this.status.buffer.buffered.length === 0)
        return 0;

    this.status.bufferedUntil = this.status.buffer.buffered.end(this.status.buffer.buffered.length - 1);
};

// #EXTERNAL
MediaController.prototype.load = function(audioObject) {
    this.changeState(this.validStates.INITIALIZING);
    console.warn("MEDIA: Initializing new audio object");

    if (!audioObject ||(audioObject && !audioObject instanceof AudioObject)) {
        console.error("MEDIA: audioObject is defined or not an instance of AudioObject");
        this.changeState(this.validStates.IDLE);
        return false;
    }

    // If mimetype isn't supported, there's no need to go any further
    if (!MediaSource.isTypeSupported(audioObject.MIME_TYPE)) {
        console.error("MEDIA: Browser does not support this audio type: " + audioObject.MIME_TYPE);
        this.changeState(this.validStates.IDLE);
        return false;
    }

    this.streamController.stop("New media loaded");
    this.reset();
    this.decideBufferStrategy(audioObject.SIZE);
    
    view.onMediaMimetypeKnown(audioObject.MIME_TYPE);

    // We load the stream and start it already
    this.streamController.load(audioObject);
    this.streamController.start();

    view.onNewStreamLoaded();

    this.status.mediaSource = new MediaSource();
    this.audioController.src = URL.createObjectURL(this.status.mediaSource);

    this.status.mediaSource.addEventListener('sourceopen', ()=> this.initMediaSourceAndSourceBuffer(
            audioObject.MIME_TYPE,
            audioObject.DURATION
        )
    );

    return true;
};

MediaController.prototype.decideBufferStrategy = function(audioObjectSize) {
    if (audioObjectSize < this.BUFFER_MAX_SIZE) {
        if (this.debug) console.log(`MEDIA: Audio data is less than our audio buffer size (${audioObjectSize}), buffering fully`);
        this.status.bufferStrategy = this.bufferStrategies.FILL;
        view.onMediaBufferStrategyKnown();
        return;
    }

    if (this.debug) console.log(`MEDIA: Audio data is bigger than our audio buffer size (${audioObjectSize}), buffering incrementally`);
    this.status.bufferStrategy = this.bufferStrategies.INCREMENT;
    view.onMediaBufferStrategyKnown();
};

MediaController.prototype.initMediaSourceAndSourceBuffer = function(mimeType, duration) {
    this.status.buffer = this.status.mediaSource.addSourceBuffer(mimeType);
    this.status.mediaSource.duration = duration;

    this.status.buffer.addEventListener("update", ()=> this.onBufferUpdated());
    this.status.mediaSource.addEventListener("sourceended", ()=> this.onSourceClosed());

    this.changeState(this.validStates.READY_TO_PLAY);
    if (this.debug) console.log(`MEDIA: Controller initialized, ready to audio buffer and play audio data (${mimeType})`);
};

MediaController.prototype.updateAudioBuffer = function() {
    if ([this.validStates.STOPPING, this.validStates.STALLED].includes(this.status.state))
        return false;
    
    if (this.status.buffer.updating) {
        if (this.debug) console.warn("MEDIA: Audio buffer is locked, retrying in a moment");
        
        wait(this.BUFFER_LOCK_RETRY).then(()=> this.updateAudioBuffer());
        return false;
    }

    if (this.status.streamComplete && this.status.nextDataChunk > this.status.nextAvailableDataChunk) {
        if (this.debug) console.log("MEDIA: Final chunk has been added to audio buffer");
        
        this.closeStream();
        return true;
    };


    if (this.debug) console.log(`MEDIA: Updating audio buffer (chunk ${this.status.nextDataChunk})`);
    let dataChunk = 0;

    if (this.streamController.audioObject.getFragment)
        dataChunk = this.streamController.audioObject.getFragment(this.status.nextDataChunk);
    else
        return false;
    
        if (this.debug) console.log(`MEDIA: Appending data chunk to audio buffer (${dataChunk.byteLength} bytes)`);
    
    this.status.nextDataChunk++;
    this.status.bufferedBytes = this.status.bufferedBytes + dataChunk.byteLength;
    
    if (this.status.buffer.appendBuffer)
        this.status.buffer.appendBuffer(dataChunk);
    else
        return;

    this.status.lastUpdate = performance.now();

    return true;
};

MediaController.prototype.trimBuffer = function(start, end) {

    if (this.status.buffer.updating) {
        console.warn("MEDIA: Audio buffer is locked, retrying in a second");
        
        wait(this.BUFFER_LOCK_RETRY).then(()=> this.trimBuffer(start, end));
        return;
    }

    const removeDuration = end - start;
    const bytesRemoved = this.streamController.audioObject.BYTES_PER_SECOND * removeDuration;

    this.status.bufferedBytes = this.status.bufferedBytes - bytesRemoved;
    console.log(`MEDIA: Attempting to remove ${Math.round(removeDuration)} seconds of data from the audio buffer (est. ${Math.round(bytesRemoved)} bytes)`);
    
    this.status.buffer.remove(start, end);
    this.status.bufferBeingTrimmed = true;
    this.status.bufferLastTrimmed = this.audioController.currentTime;
};

// #EXTERNAL
MediaController.prototype.startPlayback = function() {
    if (![this.validStates.READY_TO_PLAY, this.validStates.INITIALIZING].includes(this.status.state) && this.audioController.paused) {
        this.audioController.play();
        return;
    }

    console.log("MEDIA: Starting playback and audio data buffering");
    this.status.playWhenDataAvailable = true;

    if (this.status.bufferStrategy === this.bufferStrategies.INCREMENT)
        this.bufferIncrementally();
    else if (this.status.bufferStrategy === this.bufferStrategies.FILL)
        this.bufferFully();
};

// #EXTERNAL
MediaController.prototype.pausePlayback = function() {
    console.log("MEDIA: Pause playback");
    this.audioController.pause();
};

MediaController.prototype.bufferFully = function() {

    if (!this.status.streamComplete && this.status.nextDataChunk > this.status.nextAvailableDataChunk) {
        if (this.debug) console.warn(`MEDIA: Next data chunk isn't available yet, waiting (${this.CHUNK_NOT_AVAILABLE_RETRY})`);
        
        this.changeState(this.validStates.WAITING_FOR_DATA);
        wait(this.CHUNK_NOT_AVAILABLE_RETRY).then(()=> this.bufferFully());
        
        return false;
    }

    const lastUpdateDifference = performance.now() - this.status.lastUpdate;

    if (lastUpdateDifference < this.BUFFER_UPDATE_INTERVAL) {
        if (this.debug) console.warn(`MEDIA: Buffer updated less than ${this.BUFFER_UPDATE_INTERVAL}ms ago (${Math.round(lastUpdateDifference)}ms). Throttling`);
        wait(this.BUFFER_UPDATE_INTERVAL + 5).then(()=> this.bufferFully());
        
        return false;
    }

    this.changeState(this.validStates.BUFFERING);
    this.updateAudioBuffer();
};

MediaController.prototype.bufferIncrementally = function() {
    // At this point the buffering is controlled by the sourceBuffer update-event
    if (this.status.bufferingAhead)
        return;

    const playCursor = this.audioController.currentTime;
    const timeDifference = this.status.bufferedUntil - playCursor;

    if (timeDifference < this.BUFFER_AHEAD_THRESHOLD) {
        this.changeState(this.validStates.BUFFERING); 
        if (this.debug) console.warn(`MEDIA: Less than ${this.BUFFER_AHEAD_THRESHOLD} playable seconds in audio buffer`);

        if (playCursor - this.status.bufferLastTrimmed > this.BUFFER_TRIM_SECONDS) {
            if (this.debug) console.warn(`MEDIA: More than ${this.BUFFER_TRIM_SECONDS} seconds trail in audio buffer, trimming first`);
            this.trimBuffer(this.status.buffer.buffered.start(0), playCursor - 5);
            return;
        }
        
        this.status.bufferAheadMark = this.audioController.currentTime;
        this.status.bufferingAhead = true;
        this.bufferAhead();

        return true;
    }

    if (this.status.state !== this.validStates.HAS_ENOUGH_DATA) {
        this.changeState(this.validStates.HAS_ENOUGH_DATA);
        if (this.debug) console.log(`MEDIA: Enough data in audio buffer, waiting until ${(this.status.bufferedUntil - this.BUFFER_AHEAD_THRESHOLD).toFixed(2)}`);
    }
};

MediaController.prototype.closeStream = function() {

    if (this.status.buffer.updating) {
        if (this.debug) console.warn("MEDIA: Buffer is locked, retrying in a moment");

        wait(this.BUFFER_LOCK_RETRY).then(()=> this.closeStream());
        return false;
    }

    if (this.status.mediaSource.readyState === "open") {
        if (this.debug) console.log("MEDIA: Closing buffer");

        this.status.mediaSource.endOfStream();
        this.changeState(this.validStates.COMPLETED);
    }

    return true;
};

MediaController.prototype.bufferAhead = function() {

    if (!this.status.streamComplete && this.status.nextDataChunk > this.status.nextAvailableDataChunk) {
        if (this.debug) console.warn(`MEDIA: Next data chunk isn't available yet, waiting (${this.CHUNK_NOT_AVAILABLE_RETRY})`);
        
        this.changeState(this.validStates.WAITING_FOR_DATA);
        wait(this.CHUNK_NOT_AVAILABLE_RETRY).then(()=> this.bufferAhead());
        
        return false;
    }

    if (this.status.bufferedUntil - this.status.bufferAheadMark > this.BUFFER_AHEAD) {
        if (this.debug) console.log(`MEDIA: Buffered enough data ahead (${this.BUFFER_AHEAD} seconds)`);
        this.status.bufferingAhead = false;
        return true;
    }

    this.updateAudioBuffer();
};

MediaController.prototype.changeState = function(newState) {
    if (!Object.values(this.validStates).includes(newState)) {
        console.error("MEDIA: Can't change state. Argument is not a valid state: " + newState);
        return false;
    }

    this.status.state = newState;
    view.onMediaStateChange();
};

// OBJECT CONSTRUCTOR
MediaController.prototype.StatusTracker = function(initialState) {

    this.state = initialState;
    this.mediaSource = {}; // Instance of MediaSource
    this.buffer = {}; // Instance of SourceBuffer
    this.lastUpdate = 0; //performance.now() timestamp
    this.bufferedBytes = 0;
    this.bufferedDuration = 0.0; //Seconds
    this.bufferedUntil = 0.0; //Seconds
    this.nextDataChunk = 0;
    this.playWhenDataAvailable = false;
    this.nextAvailableDataChunk = -1; // This will be updated by the streamcontroller
    this.streamComplete = false; // This will be updated by the streamcontroller
    this.bufferingComplete = false;
    this.bufferStrategy = Symbol("UNDECIDED");
    this.lastPlaytimeUpdate = 0.0; //performance.now() timestamp
    this.bufferingAhead = false;
    this.bufferAheadMark = 0.0; //Seconds, corresponding to timestamp from the audio track's duration
    this.bufferBeingTrimmed = false;
    this.bufferLastTrimmed = 0.0; //Seconds, corresponding to timestamp from the audio track's duration

    return Object.seal(this);
};