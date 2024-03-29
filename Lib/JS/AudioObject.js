import { BaseClass } from './BaseClass.js';

/** Represents a piece of audio that can be played */
class AudioObject
{
    /**
     *
     * @param {string} trackID - The ID of the audio track this object represents. Should match an ID present in the master index
     * @param {string} mimeType - The mimetype of the audio data
     * @param {number} size - The full size of the audio data in bytes
     * @param {number} duration - The duration of the audio data in fractional seconds
     * @returns An object representing a source of audio data
     */
    constructor(trackID, mimeType, size, duration) {

        this.size = size;
        this.trackID = trackID;
        this.duration = duration;
        this.mimeType = mimeType;

        if (this.mimeType === "audio/x-m4a" || this.mimeType === "audio/m4a")
            this.mimeType = 'audio/mp4;codecs="mp4a.40.2"'; // Codec info must be added

        return new Proxy(this, BaseClass);
    }

    getID() {return this.trackID}
    getSource() {return this.sourceURL}
}

export { AudioObject };