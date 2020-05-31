class AudioObject {

    constructor(streamURL, mimeType, size, duration) {
        this.mediaSource = null;
        this.bufferSource = null;
        this.updatingBuffer = false;
        this.error = false;
        this.objectURL = URL.createObjectURL(this.mediaSource);
        this.mimeType = mimeType || "INVALID_MIME_TYPE";
        this.dataStream = null;
        this.bufferUntilSeconds = 0;
        this.ready = false;
        this.completed = false;

        if (this.mimeType === "audio/x-m4a" || this.mimeType === "audio/m4a")
            this.mimeType = 'audio/mp4;codecs="mp4a.40.2"'; // Codec info must be added

        if (!MediaSource.isTypeSupported(this.mimeType))
            return null;

        this.mediaSource = new MediaSource();
        this.mediaSource.duration = duration;
        this.dataStream = new AudioTrackStream(streamURL, size);
        this.dataStream.open().then(()=> this.ready = true).catch(()=> this.error = true);

        // "sourceopen"-event will only trigger once:
        // the media source object URL is set on the Audio-element
        // the media source object URL is set on a Source-element AND it's appended to the Audio-element as a child
        this.mediaSource.addEventListener("sourceopen", ()=> {
            if (this.error || !this.ready) return;

            this.bufferSource = this.mediaSource.addSourceBuffer(this.mimeType);
            this.bufferSource.addEventListener("updateend", this._buffer);
            this.bufferSource.addEventListener("error", ()=> this.error = true);
        });

        return Object.seal(this);
    }

    bufferUntil(seconds) {
        if (this.error || !this.ready || this.completed || this.updatingBuffer) return;

        this.bufferUntilSeconds = seconds;
        this.updatingBuffer = true;
        this._buffer();
    }

    dispose() {
        URL.revokeObjectURL(this.objectURL);
        this.dataStream.close();
        if (this.mediaSource.readyState == "open")
            this.mediaSource.endOfStream();

        this.ready = false;
    }

    _buffer() {
        if (this.dataStream.closed || this.bufferSource.buffered.length && this.bufferSource.buffered.end(0) >= this.bufferUntilSeconds) {
            this._onBufferingDone();
            return;
        }

        this.dataStream.read(dataChunk=> {
            if (dataChunk)
                this.bufferSource.appendBuffer(dataChunk);
            else {
                this.completed = true;
                this._onBufferingDone();
            }
        })
    }

    _onBufferingDone() {
        this.bufferUntilSeconds = 0;
        this.updatingBuffer = false;
    }
}