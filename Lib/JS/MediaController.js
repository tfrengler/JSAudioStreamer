import { AudioObject } from "./AudioObject.js";

/*
    To get audio working via streaming:
    - Create an Audio-element
    - Create a MediaSource
    - Create SourceBuffer from MediaSource instance
    - Create object url from MediaSource instance
    - Set object url either on Audio-element OR
    - Create Source-element, set object url on it and then append to Audio-element
    - Call load() on Audio-element to rescan sources and select one available
*/

/* WORKFLOW:
    - loadNextTrack() prepares the next song. It does so by creating a new AudioObject() which is stored in nextAudioTrack
    - if loadNextTrack() is called with true as second param OR the current track has ended playback _rotateTrack() is called
    - _rotateTrack() swaps nextAudioTrack over to currentAudioTrack, nulling nextAudioTrack
    - it then swaps currentSourceElement with nextSourceElement, while also setting nextSourceElement.src to empty string
    - it calls audioElement.load() which causes the HTMLMediaElement to rescan its Source-elements, picking the one with an valid src-attrib
    - then it calls currentAudioTrack.open(), which upon success calls currentAudioTrack.bufferUntil()
    - once the AudioObject() has enough frames to play, playback is automatically started (this._onTrackPlayable, triggerd via the "canplay" event)
*/

let Immutable = {
    configurable: false,
    enumerable: false,
    writable: false
};

export class MediaController {
    
    constructor(entryPoint, serviceLocator) {
        // Properties
        this.services = serviceLocator || null;
        this.events = serviceLocator.get("events");

        this.audioElement = new Audio();
        this.audioElement.autoplay = false;
        this.audioElement.preload = "metadata";
        this.audioElement.appendChild(document.createElement("source"));
        this.audioElement.appendChild(document.createElement("source"));

        this.audioElement.addEventListener("playing", ()=> {
            this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_PLAYING);
        });

        // Replay gain
        this.audioContext = new AudioContext();
        let mediaElementSource = this.audioContext.createMediaElementSource(this.audioElement); 
        this.gainNode = this.audioContext.createGain();
        mediaElementSource.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);

        this.CHROME_SOURCEBUFFER_LIMIT = 12582912;
        this.FIREFOX_SOURCEBUFFER_LIMIT = 15728640;
        this.EDGE_SOURCEBUFFER_LIMIT = 12582912;

        this.playCursorLastUpdated = 0;
        this.desiredBufferHead = 90;
        this.bufferAheadTriggerTreshold = 30;
        this.preparingNextTrackThreshold = 5;
        this.failedTracksLimit = 3;
        this.failedTracks = 0;
        this.entryPoint = entryPoint;

        this.preparingNextTrack = false;
        this.currentAudioTrack = null;
        this.nextAudioTrack = null;
        this.currentSourceElement = this.audioElement.children[0];
        this.nextSourceElement = this.audioElement.children[1];

        Object.defineProperties(this, {
            audioElement: Immutable,
            desiredBufferHead: Immutable,
            bufferAheadTriggerTreshold: Immutable,
            failedTracksLimit: Immutable,
            entryPoint: Immutable,
            audioContext: Immutable,
            gainNode: Immutable,
            CHROME_SOURCEBUFFER_LIMIT: Immutable,
            FIREFOX_SOURCEBUFFER_LIMIT: Immutable,
            EDGE_SOURCEBUFFER_LIMIT: Immutable
        });
    
        // Event handlers
        this.audioElement.addEventListener("loadedmetadata", ()=> this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_METADATA_LOADED));
        this.audioElement.addEventListener("waiting", ()=> this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_WAITING));
        this.audioElement.addEventListener("stalled", ()=> this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_STALLED));
        this.audioElement.addEventListener("ended", this._onTrackEnded.bind(this));
        this.audioElement.addEventListener("canplay", this._onTrackPlayable.bind(this));
        this.audioElement.addEventListener("error", this._onError.bind(this));
        this.audioElement.addEventListener("durationchange", this._onDurationChange.bind(this));
        this.audioElement.addEventListener("timeupdate", this._onPlayCursorChange.bind(this));

        console.log("MediaController initialized" + `${this.services ? ", with services" : ""}`);
        return Object.seal(this);
    }

    // PUBLIC
    play() {
        if (!this.currentAudioTrack) return;
        if (!this.audioElement.paused) return;

        this.audioElement.play().then(()=> {
            this.audioContext.resume();
            // this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_PLAYING);
        })
        .catch(error=> this._onError(error));
    }

    pause() {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_PAUSED);
        this.audioElement.pause();
        this.audioContext.suspend();
    }

    mute() {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_MUTED, {muted: !this.audioElement.muted});
        this.audioElement.muted = !this.audioElement.muted;
    }

    setVolume(volume) {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_VOLUME_CHANGE, {new_volume: volume});
        this.audioElement.volume = volume || 1.0;
    }

    // This is the one called from outside when clicking on a track from the playlist
    loadNextTrack(trackID, load) {
        if (this.failedTracks >= this.failedTracksLimit) {
            this.events.manager.trigger(this.events.types.ERROR, new Error(`MediaController: ${this.failedTracksLimit} tracks failed to load in a row, aborting further attempts`));
            return;
        }

        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_LOADING_NEXT_TRACK, {trackID: trackID, rotateImmediately: load});
        const TrackData = this.services.get("indexes").getTrackData(trackID);

        if (TrackData.ERROR) {
            this.events.manager.trigger(this.events.types.ERROR, new Error("MediaController: TrackData could not be loaded from index: " + trackID));
            this.failedTracks++;
            this._prepareNextTrack();
        }

        let nextAudioTrack = new AudioObject(
            trackID,
            this.entryPoint + trackID,
            TrackData.Mimetype,
            TrackData.Size,
            TrackData.Duration,
            this.events
        );

        nextAudioTrack.ready().then(objectURL=> {
            // So apparently appending a source-element to an audio-element triggers load() if there are no current sources selected...
            // Thus we are going to have two source-elements that we'll swap between, similar to the audio objects
            // Maybe it's still possible to utilize appendChild if we set the src-attrib AFTER appending?
            this.nextSourceElement.dataset.trackid = trackID;
            this.nextSourceElement.src = objectURL;
            this.nextAudioTrack = nextAudioTrack;
            this.failedTracks = 0;
            
            if (load === true)  {
                if (this.currentAudioTrack) this.currentAudioTrack.dispose();
                this._rotateTrack();
            }
        })
        .catch(error=> {
            nextAudioTrack.dispose();
            this.nextAudioTrack = null;

            if (error && error instanceof Error) this.events.manager.trigger(this.events.types.ERROR, error);
            this.failedTracks++;
            this._prepareNextTrack();
        })
    }

    // PRIVATE
    _rotateTrack() {
        this.currentAudioTrack = this.nextAudioTrack;
        this.nextAudioTrack = null;
    
        let previousSourceElement = this.currentSourceElement;
        previousSourceElement.src = "";

        this.currentSourceElement = this.nextSourceElement;
        this.nextSourceElement = previousSourceElement;

        // Loads triggers the "timeupdate"-event if currentTime is above 0 (if another track has been playing), because it moves the cursor back to 0 again
        this.audioElement.load();
        this.preparingNextTrack = false;
        this.currentAudioTrack.open().then(()=> {

            let trackData = this.services.get("indexes").getTrackData(this.currentAudioTrack.getID());
            let gainValue = 1.0;

            if (trackData.ReplayGainTrack) gainValue = Math.pow(10, (trackData.ReplayGainTrack / 20));
            this.gainNode.gain.value = gainValue;

            this.events.manager.trigger(
                this.events.types.MEDIA_CONTROLLER_GAIN_CHANGED,
                {value: gainValue, decibels: trackData.ReplayGainTrack}
            );

            this.currentAudioTrack.bufferUntil(this.desiredBufferHead);

            this.events.manager.trigger(
                this.events.types.MEDIA_CONTROLLER_TRACK_ROTATED,
                {trackID: this.currentAudioTrack.getID(), trackData: trackData}
            );
        })
        .catch(error=> {
            if (error && error instanceof Error) this.events.trigger(this.events.types.ERROR, error);
            this._prepareNextTrack();
        });
    }

    _prepareNextTrack() {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_PREPARING_NEXT_TRACK);

        let nextTrackID = this.services.get("playlist").getNext();
        if (nextTrackID)
            this.loadNextTrack(nextTrackID, false);
    }

    _onTrackEnded() {
        this.events.manager.trigger(
            this.events.types.MEDIA_CONTROLLER_TRACK_ENDED, 
            {
                trackID_current: this.currentAudioTrack.getID(),
                trackID_next: this.nextAudioTrack ? this.nextAudioTrack.getID() : ""
            }
        );
        this.currentAudioTrack.dispose()
        if (this.nextAudioTrack) this._rotateTrack();
    }

    _onTrackPlayable() {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_TRACK_PLAYABLE);
        this.play();
    }

    _onError(error) {
        this.events.manager.trigger(this.events.types.ERROR, error);
        if (this.audioElement.error && this.audioElement.error.name === "QuotaExceededError")
            this.events.manager.trigger(this.events.types.ERROR, new Error("MediaController: SourceBuffer overflowed. Too much data was added, without the ability for the sourcebuffer to trim"));
        
        // Perhaps consider a way to ensure that the 2 minutes of data we buffer ahead doesn't overflow the buffer? Unlikely, but still
    }

    _onDurationChange() {
        if (this.audioElement.duration === Infinity) return;
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_DURATION_CHANGED, {duration: this.audioElement.duration});
    }

    _onPlayCursorChange() {
        if ((performance.now() - this.playCursorLastUpdated) < 900)
            return;

        this.playCursorLastUpdated = performance.now();

        if (!this.preparingNextTrack && (this.audioElement.duration - this.audioElement.currentTime || 9999) <= this.preparingNextTrackThreshold) {
            this.preparingNextTrack = true;
            this._prepareNextTrack();
        }

        if (this.currentAudioTrack && (this.currentAudioTrack.hasErrored() || this.currentAudioTrack.isComplete() || this.currentAudioTrack.isBusy())) return;
        
        if (this.audioElement.buffered.length && this.audioElement.buffered.end(0) - this.audioElement.currentTime < this.bufferAheadTriggerTreshold)
        {
            let bufferMark = this.audioElement.buffered.end(0) + this.desiredBufferHead;
            this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_BUFFERING_AHEAD, {seconds: this.desiredBufferHead});
            this.currentAudioTrack.bufferUntil(bufferMark);
        }
    }
}