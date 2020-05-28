"use strict";

const AudioObject = function(id, size, duration, mimeType) { // eslint-disable-line no-unused-vars

    this.ID = id || "UNKNOWN";
    this.SIZE = parseInt(size) || 0;
    this.BYTES_PER_SECOND = (this.SIZE / duration) || 0.0;
    this.DURATION = parseFloat(duration) || 0.0; // A rough estimation of how many bytes per second
    this.MIME_TYPE = mimeType || "UNKNOWN";
    this.dataFragments = new Set(); // list of array buffers (Uint8Array)

    return Object.freeze(this);
};

AudioObject.prototype.getStoredBytes = function() {
    let finalDataSize = 0;
    this.dataFragments.forEach((value)=>{
        finalDataSize = (finalDataSize + value.byteLength);
    });
    return finalDataSize || -1;
};

AudioObject.prototype.getStoredPercentage = function() {
    return ((this.getStoredBytes() / this.SIZE) * 100).toFixed(2);
};

AudioObject.prototype.started = function() {
    return this.dataFragments.size > 0;
};

AudioObject.prototype.addToBuffer = function(arrayBuffer) {
    if (!arrayBuffer instanceof Uint8Array) {
        console.error("AUDIO_OBJECT: arrayBuffer is NOT a Uint8Array: " + chunk.constructor.name);
        return false;
    };

    this.dataFragments.add(arrayBuffer);
    return true;
};

AudioObject.prototype.getFragment = function(index) {
    return Array.from(this.dataFragments)[index] || null;
};

AudioObject.prototype.getFragmentCount = function() {
    return this.dataFragments.size;
};