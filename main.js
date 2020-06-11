"use strict";

// const backendEntryPoint = "CFCs/AjaxProxy.cfc";

import { JSUtils } from "./Utils.js";
import * as EventScope from "./EventManager.js";
import { MediaController } from "./MediaController.js";
import { ServiceLocator } from "./ServiceLocator.js";
import { UI_Controller } from "./UI_Controller.js";
import { PlayList } from "./Playlist.js";

const Services = new ServiceLocator();

const Events = Object.create(null);
Events.manager = new EventScope.EventManager();
Events.types = EventScope.EventTypes;
Services.provide("events", Events);

const Indexes = {
	MasterAudioTrackIndex: {},
	AudioTrackIndexes: {
		ALBUMS: {},
		ALBUM_ARTISTS: {},
		TRACK_ARTISTS: {},
		GENRES: {}
	},
	BackendIndex: {}
};
Services.provide("indexes", Indexes);

const Playlist = new PlayList(Services);
Services.provide("playlist", Playlist);

const Player = new MediaController(Services);
Services.provide("player", Player);

const UIController = new UI_Controller(Services);
Services.lock();

const loadMusicIndex = function() {
	fetch("Data/ClientIndex.json", {cache: "no-store", mode: "same-origin", method: "GET", redirect: "error"})
	.then(response=> response.json())
	.then(jsonResponse=> {
		
		Indexes.MasterAudioTrackIndex = JSUtils.deepFreeze(jsonResponse);
		JSUtils.Log(`Client index loaded (${Object.keys(Indexes.MasterAudioTrackIndex).length} tracks)`);
		buildMusicIndexes();
	});

	fetch("Data/BackendIndex.json", {cache: "no-store", mode: "same-origin", method: "GET", redirect: "error"})
	.then(response=> response.json())
	.then(jsonResponse=> {
		
		Indexes.BackendIndex = JSUtils.deepFreeze(jsonResponse);
		JSUtils.Log(`Backend index loaded (${Object.keys(Indexes.BackendIndex).length} tracks)`);
	});
}

const buildMusicIndexes = function() {
	// Instead of storing the trackID's, maybe store references to the tracks from the master index?
	for (let trackID in Indexes.MasterAudioTrackIndex) {
		let currentTrack = Indexes.MasterAudioTrackIndex[trackID];
		
		let TrackArtists = currentTrack.TrackArtists || "_UNKNOWN_";
		let AlbumArtists = currentTrack.AlbumArtists || "_UNKNOWN_";
		let Album = currentTrack.Album || "_UNKNOWN_";
		let Genres = currentTrack.Genres || "_UNKNOWN_";

		if (Indexes.AudioTrackIndexes.ALBUMS[Album]) 
			Indexes.AudioTrackIndexes.ALBUMS[Album].push(trackID);
		else
			Indexes.AudioTrackIndexes.ALBUMS[Album] = [trackID];

		if (Indexes.AudioTrackIndexes.TRACK_ARTISTS[TrackArtists]) 
			Indexes.AudioTrackIndexes.TRACK_ARTISTS[TrackArtists].push(trackID);
		else
			Indexes.AudioTrackIndexes.TRACK_ARTISTS[TrackArtists] = [trackID];

		if (Indexes.AudioTrackIndexes.ALBUM_ARTISTS[AlbumArtists]) 
			Indexes.AudioTrackIndexes.ALBUM_ARTISTS[AlbumArtists].push(trackID);
		else
			Indexes.AudioTrackIndexes.ALBUM_ARTISTS[AlbumArtists] = [trackID];

		if (Indexes.AudioTrackIndexes.GENRES[Genres]) 
			Indexes.AudioTrackIndexes.GENRES[Genres].push(trackID);
		else
			Indexes.AudioTrackIndexes.GENRES[Genres] = [trackID];
	}

	JSUtils.deepFreeze(Indexes.AudioTrackIndexes);

	JSUtils.Log("Audio track indicies built");
	UIController._createAlbumList();
}

// Debug mode, expose the stuff to the user so we can access stuff via the console
if (window.location.href.indexOf("?DevMode=1") > -1) {
	window.main = Object.seal({
		services: Services,
		events: Events,
		indexes: Indexes,
		playlist: Playlist,
		player: Player,
		uiController: UIController
	})
}

// Object.freeze(main);

window.onload = () => {
	UIController.init();
	loadMusicIndex();
	console.warn("Everything is initialized and ready to rock and roll");
}
