const AudioStream = function(contentSize) {

    this.SIZE = parseInt(contentSize) || 0;
    this.CHUNKS_EXPECTED = Math.floor(this.SIZE / CHUNK_SIZE);
    this.CHUNKS = [];

    this.status = Object.create(null);
    this.status.complete = ()=> (this.chunks.length === this.chunksExpected);
    this.status.nextChunk = 1;
    this.status.getBufferedBytes = this.calculateBufferedBytes;
    this.status.started = ()=> streamResponse.chunks.length > 0;
    this.status.lastUpdate = 0.0;
    this.status.getBufferedPercentage = function() {return this.getBufferedBytes() / streamResponse.size * 100};

    this._calculateBufferedBytes = function() {
        let finalBufferedSize = 0;
        this.CHUNKS.forEach((value)=>{
            finalBufferedSize = (finalBufferedSize + value.byteLength);
        });
        return finalBufferedSize || -1;
    };

    Object.seal(this.status);
    return Object.freeze(this);
};