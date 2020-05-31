"use strict";

// const backendEntryPoint = "CFCs/AjaxProxy.cfc";
const main = Object.create(null);

import * as Events from "./EventManager.js";
import { MediaController } from "./MediaController.js";

main = Object.create(null);

let eventManager = new Events.EventManager();
// let controllerServices = new ServiceLocator();

// Services
// let notifications = new NotificationManager(document.getElementById('Notifications'), 2000);
// let authentication = new AuthenticationManager(backendEntryPoint, CFAjaxAuthKey);

// controllerServices.provide("notifications", notifications);
// controllerServices.provide("events", eventManager);
// controllerServices.provide("eventTypes", Events.EventTypes);
// controllerServices.provide("authentication", authentication);

main.player = new MediaController();

// Debug mode, expose the stuff to the user so we can access stuff via the console
// if (window.location.href.indexOf("?DevMode=1") > -1)
	window.main = main;

Object.freeze(main);
console.warn("Everything's initialized and ready to rock and roll");