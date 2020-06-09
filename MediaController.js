import { JSUtils } from "./Utils.js";
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

let Immutable = {
    configurable: false,
    enumerable: false,
    writable: false
};

class MediaController {
    
    constructor(serviceLocator) {
        // Properties
        this.services = serviceLocator || null;
        this.events = serviceLocator.get("events");

        this.audioElement = new Audio();
        this.audioElement.autoplay = false;
        this.audioElement.preload = "metadata";
        this.audioElement.appendChild(document.createElement("source"));
        this.audioElement.appendChild(document.createElement("source"));

        this.CHROME_SOURCEBUFFER_LIMIT = 12582912;
        this.FIREFOX_SOURCEBUFFER_LIMIT = 15728640;
        this.EDGE_SOURCEBUFFER_LIMIT = 12582912;

        this.playCursorLastUpdated = 0;
        this.desiredBufferHead = 120;
        this.bufferAheadTriggerTreshold = 30;
        this.unreachableSourcesLimit = 3;
        this.unreachableSources = 0;

        this.preparingNextTrack = false;
        this.currentAudioTrack = null;
        this.nextAudioTrack = null;
        this.currentSourceElement = this.audioElement.children[0];
        this.nextSourceElement = this.audioElement.children[1];

        Object.defineProperties(this, {
            audioElement: Immutable,
            desiredBufferHead: Immutable,
            bufferAheadTriggerTreshold: Immutable,
            unreachableSourcesLimit: Immutable,
            CHROME_SOURCEBUFFER_LIMIT: Immutable,
            FIREFOX_SOURCEBUFFER_LIMIT: Immutable,
            EDGE_SOURCEBUFFER_LIMIT: Immutable
        });
    
        // Event handlers
        this.audioElement.addEventListener("loadedmetadata", this._onTrackMetadataLoaded.bind(this));
        this.audioElement.addEventListener("waiting", this._onWaiting.bind(this));
        this.audioElement.addEventListener("stalled", this._onStalled.bind(this));
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
            this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_PLAYING);
            JSUtils.Log("MediaController: Playback started");
        })
        .catch(error=> this._onError(error));
    }

    pause() {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_PAUSED);
        this.audioElement.pause();
        JSUtils.Log("MediaController: Playback paused");
    }

    mute() {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_MUTED);
        this.audioElement.muted = !this.audioElement.muted;
        JSUtils.Log(`MediaController: Volume ${this.audioElement.muted ? "muted" : "un-muted"}`);
    }

    setVolume(volume) {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_VOLUME_CHANGE);
        this.audioElement.volume = volume || 1.0;
    }

    // This is the one called from outside when clicking on a track from the playlist
    loadNextTrack(trackID, load) {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_LOADING_NEXT_TRACK);
        JSUtils.Log("MediaController: Loading next track: " + trackID);

        const TrackData = this.services.get("indexes").MasterAudioTrackIndex[trackID];
        const BackendData = this.services.get("indexes").BackendIndex[trackID]; // TODO(thomas): Needs to be taken out eventually

        if (!TrackData) {
            JSUtils.Log("MediaController: TrackData could not be loaded from index: " + trackID, "ERROR");
            throw new Error("TrackData could not be loaded: " + trackID);
        }

        let nextAudioTrack = new AudioObject(
            trackID,
            `Data\\Music\\${BackendData.RelativePath}\\${BackendData.FileName}`, // TODO(thomas): Needs to be reworked to a cfm-url
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
            
            if (load === true) 
                this._rotateTrack();
        })
        .catch(error=> {
            nextAudioTrack.dispose();
            this.nextAudioTrack = null;

            JSUtils.Log("MediaController: nextAudioTrack.ready() threw an error", "ERROR");
            JSUtils.Log(error);

            this._prepareNextTrack();
        })
    }

    // PRIVATE
    _rotateTrack() {
        JSUtils.Log("MediaController: Rotating tracks");

        // First time through currentTrack will be null
        if (this.currentAudioTrack) this.currentAudioTrack.dispose();

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
            JSUtils.Log(`MediaController: Track data stream is open, buffering ahead (${JSUtils.getReadableTime(this.desiredBufferHead)})`);
            this.currentAudioTrack.bufferUntil(this.desiredBufferHead);
        });

        this.events.manager.trigger(
            this.events.types.MEDIA_CONTROLLER_TRACK_ROTATED,
            this.services.get("indexes").MasterAudioTrackIndex[this.currentAudioTrack.getID()]
        );
    }

    _prepareNextTrack() {
        JSUtils.Log("MediaController: Preparing next track in queue...");

        let nextTrackID = this.services.get("playlist").getNext();
        if (nextTrackID) 
            this.loadNextTrack(nextTrackID, false);
        else 
            JSUtils.Log("MediaController: ...but queue is empty!!!");
    }

    _onTrackEnded() {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_TRACK_ENDED);
        JSUtils.Log("MediaController: Playback ended for current track");
        if (this.nextAudioTrack) this._rotateTrack();
    }

    _onTrackPlayable() {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_TRACK_PLAYABLE);
        JSUtils.Log("MediaController: Enough audio frames to start playback");
        this.play();
    }

    _onError(error) {
        this.events.manager.trigger(this.events.types.ERROR, {error_message: error});
        // if (this.audioElement.error.name === "QuotaExceededError")
            // JSUtils.Log("SourceBuffer overflowed", "ERROR");
        
        JSUtils.Log(error || this.audioElement.error, "ERROR");
        // Perhaps consider a way to ensure that the 2 minutes of data we buffer ahead doesn't overflow the buffer? Unlikely, but still
    }

    _onDurationChange() {
        if (this.audioElement.duration === Infinity) return;

        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_DURATION_CHANGED, {duration: this.audioElement.duration});
        JSUtils.Log(`MediaController: Duration changed (${this.audioElement.duration})`);
    }

    _onPlayCursorChange() {
        if ((performance.now() - this.playCursorLastUpdated) < 900)
            return;

        this.playCursorLastUpdated = performance.now();

        if (!this.preparingNextTrack && (this.audioElement.duration - this.audioElement.currentTime || 9999) <= 5) {
            JSUtils.Log("MediaController: Current track almost at end...");
            this.preparingNextTrack = true;
            this._prepareNextTrack();
        }

        if (this.currentAudioTrack && (this.currentAudioTrack.isComplete() || this.currentAudioTrack.isBusy())) return;
        
        if (this.audioElement.buffered.length && this.audioElement.buffered.end(0) - this.audioElement.currentTime < this.bufferAheadTriggerTreshold)
        {
            JSUtils.Log("MediaController: Audio buffer below threshold, buffering ahead until " + JSUtils.getReadableTime(this.audioElement.buffered.end(0) + this.desiredBufferHead));
            this.currentAudioTrack.bufferUntil(this.audioElement.buffered.end(0) + this.desiredBufferHead);
        }
    }

    _onTrackMetadataLoaded() {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_METADATA_LOADED);
        JSUtils.Log("MediaController: Metadata from current track loaded");
    }

    _onWaiting() {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_WAITING);
        JSUtils.Log("MediaController: Playback stopped - lack of data from source. This may be temporary (latency, seeking)", "WARNING");
    }

    _onStalled() {
        this.events.manager.trigger(this.events.types.MEDIA_CONTROLLER_STALLED);
        JSUtils.Log("MediaController: Streaming data from media source has stalled", "ERROR");
    }

}

export {MediaController};