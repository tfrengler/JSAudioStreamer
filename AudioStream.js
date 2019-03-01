"use strict";

const AudioStream = function(metadata, chunkSize, id) {

    this.METADATA = metadata || {};
    this.ID = id || "UNKNOWN";
    this.SIZE = parseInt(this.METADATA.size) || 0;
    this.CHUNKS_EXPECTED = Math.floor(this.SIZE / chunkSize) || 0;
    this.CHUNKS = [];

    const _calculateBufferedBytes = function(self) {
        let finalBufferedSize = 0;
        self.CHUNKS.forEach((value)=>{
            finalBufferedSize = (finalBufferedSize + value.byteLength);
        });
        return finalBufferedSize || -1;
    };

    const _calculateBufferedPercentage = function(self) {
        return (self.status.getBufferedBytes() / self.SIZE) * 100;
    };

    this.status = Object.create(null);
    this.status.nextChunk = 0;
    this.status.lastUpdate = 0.0;
    this.status.complete = ()=> (this.CHUNKS.length === this.CHUNKS_EXPECTED);
    this.status.getBufferedBytes = ()=> _calculateBufferedBytes(this);
    this.status.started = ()=> this.CHUNKS.length > 0;
    this.status.onLastChunk = ()=> this.status.nextChunk === (this.CHUNKS_EXPECTED - 1);
    this.status.getBufferedPercentage = ()=> _calculateBufferedPercentage(this);

    Object.seal(this.status);
    return Object.freeze(this);
};