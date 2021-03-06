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

let Immutable = {
    configurable: false,
    enumerable: false,
    writable: false
};

export class AudioObject {
    constructor(trackID, streamURL, mimeType, size, duration, events) {

        this.events = events;

        this.state = STATES.INITIALIZING;
        this.trackID = trackID;
        this.mediaSource = null;
        this.bufferSource = null;
        this.dataStream = null;
        this.objectURL = null;
        this.duration = duration;
        this.mimeType = mimeType;
        this.bufferMark = 0;
        this.readErrors = 0;
        this.readErrorThreshold = 3;

        if (this.mimeType === "audio/x-m4a" || this.mimeType === "audio/m4a")
            this.mimeType = 'audio/mp4;codecs="mp4a.40.2"'; // Codec info must be added

        if (!MediaSource.isTypeSupported(this.mimeType)) {
            this.state = STATES.ERROR;
            this.events.manager.trigger(this.events.types.ERROR, new Error("AudioObject: mime-type is not supported: " + mimeType));

            return Object.freeze(this);
        }

        this.mediaSource = new MediaSource();

        // "sourceopen"-event will only trigger once:
        // - the media source object URL is set on the Audio-element
        // - the media source object URL is set on a Source-element while appended to the Audio-element as a child
        this.mediaSource.addEventListener("sourceopen", ()=> {
            if (this.state !== STATES.READY)  {
                this.state = STATES.ERROR;
                this.events.manager.trigger(this.events.types.ERROR, new Error("AudioObject: source was opened before the object was ready"));
                
                return;
            }

            // We must pass duration and set it manually like this otherwise duration will be Infinite until the stream has been read to completion
            this.mediaSource.duration = this.duration;
            this.bufferSource = this.mediaSource.addSourceBuffer(this.mimeType);

            this.bufferSource.addEventListener("updateend", ()=> {

                if (this.bufferSource.buffered.length)
                    this.events.manager.trigger(
                        this.events.types.AUDIO_OBJECT_BUFFER_UPDATED,
                        {
                            buffered_until: this.bufferSource.buffered.end(0),
                            buffered_from: this.bufferSource.buffered.start(0)
                        }
                    );

                this._buffer();
            }); 

            this.bufferSource.addEventListener("error", ()=> {
                this.state = STATES.ERROR;
                this.events.manager.trigger(this.events.types.ERROR, new Error("AudioObject: the bufferSource threw an error"));
            });

            this.state = STATES.OPEN;
            this.events.manager.trigger(this.events.types.AUDIO_OBJECT_OPEN);
        });

        this.dataStream = new DataStream(streamURL, size, this.events);
        this.dataStream.open().then(()=> {

            this.objectURL = URL.createObjectURL(this.mediaSource);
            this.state = STATES.READY;
            this.events.manager.trigger(this.events.types.AUDIO_OBJECT_READY, {object_url: this.objectURL});

        }).catch(error=> {
            this.state = STATES.ERROR;
            this.events.manager.trigger(this.events.types.ERROR, new Error("AudioObject: error while opening datastream"));

            if (error && error instanceof Error)
                this.events.manager.trigger(this.events.types.ERROR, error);
        });

        Object.defineProperties(this, {
            trackID: Immutable,
            mediaSource: Immutable,
            dataStream: Immutable,
            duration: Immutable,
            mimeType: Immutable,
            readErrorThreshold: Immutable
        });

        return Object.seal(this);
    }

    // PUBLIC
    ready() {
        return this._waitForState(STATES.READY);
    }

    open() {
        return this._waitForState(STATES.OPEN);
    }

    bufferUntil(seconds) {
        if (this.state !== STATES.OPEN) return;

        this.bufferMark = seconds;
        this.state = STATES.BUFFERING;
        this.events.manager.trigger(this.events.types.AUDIO_OBJECT_BUFFERING, {bufferMark: seconds});

        this._buffer();
    }

    dispose() {
        if (this.state === STATES.DISPOSED) return;

        URL.revokeObjectURL(this.objectURL);

        this.dataStream.close();
        if (this.mediaSource.readyState === "open")
            this.mediaSource.endOfStream();

        this.state = STATES.DISPOSED;
        this.events.manager.trigger(this.events.types.AUDIO_OBJECT_DISPOSED, {object_url: this.objectURL, mediasource_state: this.mediaSource.readyState});
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

    hasErrored() {
        return this.state == STATES.ERROR;
    }

    getID() {
        return this.trackID;
    }

    // PRIVATE
    _buffer() {
        if (this.state === STATES.ERROR || this.state === STATES.COMPLETED || this.state === STATES.DISPOSED) return;

        if (this.bufferSource.buffered.length && this.bufferSource.buffered.end(0) > this.bufferMark) {
            
            this.bufferMark = 0;
            this.state = STATES.OPEN;
            this.events.manager.trigger(this.events.types.AUDIO_OBJECT_OPEN);
            this.events.manager.trigger(
                this.events.types.AUDIO_OBJECT_BUFFER_MARK_REACHED,
                {
                    until: this.bufferSource.buffered.end(0),
                    from: this.bufferSource.buffered.start(0)
                }
            );

            return;
        }

        this.dataStream.read().then(result=> {
            if (this.state === STATES.ERROR || this.state === STATES.COMPLETED || this.state === STATES.DISPOSED) return;
            this.readErrors = 0;

            if (result.chunk) this.bufferSource.appendBuffer(result.chunk);
            if (!result.done) return;

            this.state = STATES.COMPLETED;
            this.events.manager.trigger(this.events.types.AUDIO_OBJECT_COMPLETED);
            
            this.dataStream.close();
            setTimeout(()=> this.mediaSource.endOfStream(), 500); // A delay because the sourcebuffer might still be updating
        })
        .catch(error=> {
            if (this.readErrors <= this.readErrorThreshold) {
                this.readErrors++;
                this.state = STATES.BUFFERING;
                
                this.events.manager.trigger(this.events.types.AUDIO_OBJECT_READ_ERROR, {attempts: this.readErrors, maxAttempts: this.readErrorThreshold});
                this._buffer();
                return;
            }

            this.state = STATES.ERROR;
            this.events.manager.trigger(this.events.types.ERROR, new Error("AudioObject: error while reading from datastream (final)"));
            
            if (error && error instanceof Error)
                this.events.manager.trigger(this.events.types.ERROR, error);
        })
    }

    _waitForState(state) {
        return new Promise((resolve, reject)=> {
            let audioObjectHandle = this;

            let waitForStateID = setInterval(()=> {
                if (audioObjectHandle.state === state) {
                    clearInterval(waitForStateID);
                    resolve(audioObjectHandle.objectURL);
                }

                if (audioObjectHandle.state === STATES.ERROR || audioObjectHandle.state === STATES.DISPOSED || audioObjectHandle.state === STATES.COMPLETED) {
                    clearInterval(waitForStateID);
                    reject(`AudioObject: Unable to wait for state, object has errored, been disposed or is completed (state: ${audioObjectHandle.state.description})`);
                }
            }, 10);
        });
    }
}