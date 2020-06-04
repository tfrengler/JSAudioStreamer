import {DataStream} from "./DataStream.js";

const STATES = Object.freeze({
    INITIALIZING: Symbol("INITIALIZING"),
    READY: Symbol("READY"),
    OPEN: Symbol("OPEN"),
    ERROR: Symbol("ERROR"),
    COMPLETED: Symbol("COMPLETED"),
    BUFFERING: Symbol("BUFFERING"),
    DISPOSED: Symbol("DISPOSED")
});

class AudioObject {
    // TODO(thomas): Need trackID at some point
    constructor(streamURL, mimeType, size, duration) {

        this.state = STATES.INITIALIZING;
        this.mediaSource = null;
        this.bufferSource = null;
        this.updatingBuffer = false;
        this.dataStream = null;
        this.objectURL = null;
        this.mimeType = mimeType || "INVALID_MIME_TYPE";
        this.bufferUntilSeconds = 0;
        this.lastBufferTail = 0;
        this.error = null;
        this.preloaded = null;

        if (this.mimeType === "audio/x-m4a" || this.mimeType === "audio/m4a")
            this.mimeType = 'audio/mp4;codecs="mp4a.40.2"'; // Codec info must be added

        if (!MediaSource.isTypeSupported(this.mimeType)) {
            this.state = STATES.ERROR;
            this.error = "Mime-Type not supported: " + this.mimeType;
            return Object.seal(this);
        }

        this.mediaSource = new MediaSource();

        // "sourceopen"-event will only trigger once:
        // the media source object URL is set on the Audio-element
        // the media source object URL is set on a Source-element while appended to the Audio-element as a child
        this.mediaSource.addEventListener("sourceopen", ()=> {
            if (this.state !== STATES.READY) return;

            this.mediaSource.duration = duration;
            this.bufferSource = this.mediaSource.addSourceBuffer(this.mimeType);
            this.bufferSource.appendBuffer(this.preloaded);

            this.bufferSource.addEventListener("updateend", this._buffer.bind(this)); // bind() is needed because otherwise "this" inside _buffer() refers to the global window-scope
            this.bufferSource.addEventListener("error", ()=> this.state = STATES.ERROR);

            this.state = STATES.OPEN;
        });

        this.dataStream = new DataStream(streamURL, size);
        this.dataStream.open().then(()=> {

            this.objectURL = URL.createObjectURL(this.mediaSource);
            
            this.dataStream.read().then(result=> {
                this.preloaded = result.value;
                this.state = STATES.READY;
            });

        }).catch((error)=> {
            if (error) this.error = error;
            this.state = STATES.ERROR
        });

        return Object.seal(this);
    }

    // PUBLIC
    ready() {
        return new Promise((resolve, reject)=> {
            let audioObjectHandle = this;

            let checkReadyStateID = setInterval(()=> {
                if (audioObjectHandle.state == STATES.READY) {
                    clearInterval(checkReadyStateID);
                    resolve(audioObjectHandle.objectURL);
                }

                if (audioObjectHandle.state == STATES.ERROR) {
                    clearInterval(checkReadyStateID);
                    reject(audioObjectHandle.error);
                }
            }, 200);

        });
    }

    bufferUntil(seconds) {
        if (this.state !== STATES.OPEN) return false;

        this.bufferUntilSeconds = seconds;
        this.state = STATES.BUFFERING;

        this._buffer();
        return true;
    }

    dispose() {
        if (this.state === STATES.DISPOSED) return;
        URL.revokeObjectURL(this.objectURL);

        this.dataStream.close();
        if (this.mediaSource.readyState === "open")
            this.mediaSource.endOfStream();

        // NOTE(thomas): Maybe worth making a distinction between whether the audio object has been completed (fully downloaded) and disposed of prematurely?
        this.state = STATES.DISPOSED;
    }

    isReady() {
        return this.state == STATES.READY;
    }

    getObjectURL() {
        return this.objectURL;
    }

    isBusy() {
        return this.state == STATES.BUFFERING;
    }

    isComplete() {
        return this.state == STATES.COMPLETED;
    }

    // PRIVATE
    _buffer() {   
        console.log("_buffer");
        if (this.preloaded) {
            console.log("_buffer preload, so exit");
            this.preloaded = null;
            return;
        }
        
        if (this.bufferSource.buffered.length && this.bufferSource.buffered.end(0) >= this.bufferUntilSeconds) {
            console.log("_buffer enough buffered, so exit");
            this.bufferUntilSeconds = 0;
            this.state = STATES.OPEN;

            return;
        }

        if (this.bufferSource.buffered.length && this.bufferSource.buffered.start(0) > this.lastBufferTail)
            this.lastBufferTail = this.bufferSource.buffered.start(0);

        console.log("_buffer preload, let's buffer more!");
        this.dataStream.read().then(result=> {
            if (result.done) {
                this.state = STATES.COMPLETED;

                this.dataStream.close();
                if (this.mediaSource.readyState === "open")
                    this.mediaSource.endOfStream();

                return;
            }

            this.bufferSource.appendBuffer(result.value);
        })
        .catch(error=> {
            this.state = STATES.ERROR;
            this.error = error;
        })
    }
}

export {AudioObject, STATES};