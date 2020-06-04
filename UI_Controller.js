import { JSUtils } from "./Utils.js";

class UIController {

    constructor(serviceLocator) {
        this.services = serviceLocator || null;

        this.elements = Object.create(null);

        console.log("UI Controller instantiated" + `${this.services ? ", with services" : ""}`);
        return Object.seal(this);
    }

    init() {

        this.elements.UI_Previous                   = document.getElementById("UI_Previous"); // button
        this.elements.UI_Play                       = document.getElementById("UI_Play"); // button
        this.elements.UI_Pause                      = document.getElementById("UI_Pause"); // button
        this.elements.UI_Mute                       = document.getElementById("UI_Mute"); // button
        this.elements.UI_Next                       = document.getElementById("UI_Next"); // button
        this.elements.UI_Volume                     = document.getElementById("UI_Volume"); // span
        this.elements.UI_Volume_Slider              = document.getElementById("UI_Volume_Slider"); // input range
        this.elements.UI_Player_State               = document.getElementById("UI_Player_State"); // span
        this.elements.UI_PlayCursor                 = document.getElementById("UI_PlayCursor"); // td
        this.elements.UI_Duration                   = document.getElementById("UI_Duration"); // td
        this.elements.UI_Buffered_Until             = document.getElementById("UI_Buffered_Until"); // td
        this.elements.UI_Buffer_Tail                = document.getElementById("UI_Buffer_Tail"); // td
        this.elements.UI_Audio_Buffer               = document.getElementById("UI_Audio_Buffer"); // meter
        this.elements.UI_Audio_Buffer_Limit         = document.getElementById("UI_Audio_Buffer_Limit"); // span
        this.elements.UI_Datastream_Progress        = document.getElementById("UI_Datastream_Progress"); // progress
        this.elements.UI_Datastream_BytesRead       = document.getElementById("UI_Datastream_BytesRead"); // span
        this.elements.UI_Datastream_BytesExpected   = document.getElementById("UI_Datastream_BytesExpected"); // td
        this.elements.UI_AudioObject_State          = document.getElementById("UI_AudioObject_State"); // td
        this.elements.UI_Datastream_State           = document.getElementById("UI_Datastream_State"); // td
        this.elements.UI_Error                      = document.getElementById("UI_Error"); // td
        // Track Info
        this.elements.UI_TrackID                    = document.getElementById("UI_TrackID"); // td
        this.elements.UI_Title                      = document.getElementById("UI_Title"); // td
        this.elements.UI_Album                      = document.getElementById("UI_Album"); // td
        this.elements.UI_TrackArtists               = document.getElementById("UI_TrackArtists"); // td
        this.elements.UI_Year                       = document.getElementById("UI_Year"); // td
        this.elements.UI_Genres                     = document.getElementById("UI_Genres"); // td
        this.elements.UI_Duration                   = document.getElementById("UI_Duration"); // td
        this.elements.UI_Mimetype                   = document.getElementById("UI_Mimetype"); // td
        this.elements.UI_Size                       = document.getElementById("UI_Size"); // td
        this.elements.UI_ReplayGain                 = document.getElementById("UI_ReplayGain"); // td

        console.log(`UI Controller initialized, with ${Object.keys(this.elements).length} element-handles`);
        this._initEventHandlers();
    }

    _initEventHandlers() {
        let player = this.services.get("player");

        this.elements.UI_Play.addEventListener("click", ()=> player.play());
        this.elements.UI_Pause.addEventListener("click", ()=> player.pause());
        this.elements.UI_Previous.addEventListener("click", ()=> console.warn("UI_Previous fired")); // TODO(thomas): Placeholders
        this.elements.UI_Next.addEventListener("click", ()=> console.warn("UI_Next fired")); // TODO(thomas): Placeholders
        
        this.elements.UI_Mute.addEventListener("click", ()=> {
            player.mute();
            this.elements.UI_Mute.innerHTML = `${player.audioElement.muted ? "<b>UN-MUTE</b>" : "MUTE"}`; // TODO(thomas): Reaching directly for the player is icky...
        });
        
        this.elements.UI_Volume_Slider.addEventListener("change", (event)=> {
            player.setVolume(event.srcElement.value);
            this.elements.UI_Volume.innerText = (event.srcElement.value * 100) + "%";
        });

        player.audioElement.addEventListener("playing", ()=> this.elements.UI_Player_State.innerText = "PLAYING..."); // TODO(thomas): Reaching directly for the player is icky...
        player.audioElement.addEventListener("pause", ()=> this.elements.UI_Player_State.innerText = "PAUSED"); // TODO(thomas): Reaching directly for the player is icky...

        let events = this.services.get("events");

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_PLAYING, this._onEvent, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_PAUSED, this._onEvent, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_MUTED, this._onEvent, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_VOLUME_CHANGE, this._onEvent, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_DURATION_CHANGED, this._onEvent, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_TRACK_ROTATED, this._onEvent, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_TRACK_ENDED, this._onEvent, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_LOADING_NEXT_TRACK, this._onEvent, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_TRACK_PLAYABLE, this._onEvent, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_METADATA_LOADED, this._onEvent, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_WAITING, this._onEvent, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_STALLED, this._onEvent, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_MEDIA_SOURCE_OPEN, this._onEvent, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_READY, this._onEvent, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_COMPLETED, this._onEvent, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_DISPOSED, this._onEvent, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_BUFFERING, this._onEvent, this);
        events.manager.subscribe(events.types.DATA_STREAM_OPEN, this._onEvent, this);
        events.manager.subscribe(events.types.DATA_STREAM_CLOSED, this._onEvent, this);
        events.manager.subscribe(events.types.DATA_STREAM_READING, this._onEvent, this);
        events.manager.subscribe(events.types.ERROR, this._onEvent, this);

        console.log("UI Controller: event handlers attached");
    }

    _resetPlayerUI() {
        this.elements.UI_Duration.innerText                 = "00:00 | 0";
        this.elements.UI_Buffered_Until.innerText           = "00:00";
        this.elements.UI_Buffer_Tail.innerText              = "00:00";
        this.elements.UI_Audio_Buffer.value                 = 0;
        this.elements.UI_Audio_Buffer_Limit.innerText       = "0";
        this.elements.UI_Datastream_Progress.value          = 0;
        this.elements.UI_Datastream_BytesRead.innerText     = "0";
        this.elements.UI_Datastream_BytesExpected.innerText = "0";
        this.elements.UI_AudioObject_State.innerText        = "";
        this.elements.UI_Datastream_State.innerText         = "";
    }

    _resetTrackInfoUI() {

    }

    _onEvent(data) {
        console.log("Event received");
    }
}

export {UIController};