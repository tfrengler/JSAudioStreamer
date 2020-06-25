import {DataStream} from "./DataStream.js";
import {JSUtils} from "./Utils.js";

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
    constructor(trackID, streamURL, mimeType, size, duration, events) {

        this.events = events;

        this.state = STATES.INITIALIZING;
        this.trackID = trackID;
        this.mediaSource = null;
        this.bufferSource = null;
        this.dataStream = null;
        this.objectURL = null;
        this.mimeType = mimeType;
        this.bufferMark = 0;

        if (this.mimeType === "audio/x-m4a" || this.mimeType === "audio/m4a")
            this.mimeType = 'audio/mp4;codecs="mp4a.40.2"'; // Codec info must be added

        if (!MediaSource.isTypeSupported(this.mimeType)) {
            this.state = STATES.ERROR;
            this.events.manager.trigger(this.events.types.ERROR, {error_message: "Mime-Type not supported: " + this.mimeType});

            return Object.seal(this);
        }

        this.mediaSource = new MediaSource();

        // "sourceopen"-event will only trigger once:
        // the media source object URL is set on the Audio-element
        // the media source object URL is set on a Source-element while appended to the Audio-element as a child
        this.mediaSource.addEventListener("sourceopen", ()=> {
            if (this.state !== STATES.READY)
                throw new Error("AudioObject: source was opened before the object was ready");

            this.mediaSource.duration = duration;
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
                this.events.manager.trigger(this.events.types.ERROR);
            });

            this.state = STATES.OPEN;
            this.events.manager.trigger(this.events.types.AUDIO_OBJECT_OPEN);
        });

        this.dataStream = new DataStream(streamURL, size, this.events);
        this.dataStream.open().then(()=> {

            this.objectURL = URL.createObjectURL(this.mediaSource);
            this.state = STATES.READY;
            this.events.manager.trigger(this.events.types.AUDIO_OBJECT_READY);

        }).catch(error=> {
            this.state = STATES.ERROR;
            this.events.manager.trigger(this.events.types.ERROR, {error_message: error.message});
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

    open() {
        return new Promise((resolve, reject)=> {
            let audioObjectHandle = this;

            let checkReadyStateID = setInterval(()=> {
                if (audioObjectHandle.state == STATES.OPEN) {
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
        if (this.state !== STATES.OPEN) return;

        JSUtils.Log(`AudioObject: buffering ahead... (${JSUtils.getReadableTime(seconds)} || ${seconds})`);

        this.bufferMark = seconds;
        this.state = STATES.BUFFERING;
        this.events.manager.trigger(this.events.types.AUDIO_OBJECT_BUFFERING);

        this._buffer();
    }

    dispose() {
        if (this.state === STATES.DISPOSED) return;

        JSUtils.Log("AudioObject: disposing object (revoke object URL, close stream and media source)");
        URL.revokeObjectURL(this.objectURL);

        this.dataStream.close();
        if (this.mediaSource.readyState === "open")
            this.mediaSource.endOfStream();

        // NOTE(thomas): Maybe worth making a distinction between whether the audio object has been completed (fully downloaded) and disposed of prematurely?
        this.state = STATES.DISPOSED;
        this.events.manager.trigger(this.events.types.AUDIO_OBJECT_DISPOSED);
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

    getID() {
        return this.trackID;
    }

    // PRIVATE
    _buffer() {
        if (this.state === STATES.ERROR || this.state === STATES.COMPLETED || this.state === STATES.DISPOSED) return;

        if (this.bufferSource.buffered.length && this.bufferSource.buffered.end(0) > this.bufferMark) {
            
            JSUtils.Log("AudioObject: ...buffering ended");
            this.bufferMark = 0;
            this.state = STATES.OPEN;
            this.events.manager.trigger(this.events.types.AUDIO_OBJECT_OPEN);

            return;
        }

        this.dataStream.read().then(result=> {

            if (result.chunk) this.bufferSource.appendBuffer(result.chunk);
            if (!result.done) return;

            JSUtils.Log("AudioObject: data stream read to completion, closing");
            this.state = STATES.COMPLETED;
            this.events.manager.trigger(this.events.types.AUDIO_OBJECT_COMPLETED);
            
            this.dataStream.close();
            setTimeout(()=> this.mediaSource.endOfStream(), 500);
        })
        .catch(error=> {
            this.state = STATES.ERROR;
            this.events.manager.trigger(this.events.types.ERROR);
            JSUtils.Log(error || "AudioObject: error while reading from data stream", "ERROR");
        })
    }
}

export {AudioObject};