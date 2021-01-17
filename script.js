var START = "start";
var TRANS = "transcript";
var transcript = null;

var status_line = null;
var moves_line = null;
var score_line = null;

var moves = 0;
var score = {};
var visited = {};

window.addEventListener("load", function () {
	"use strict";
	
	status_line = document.getElementById("status");
	moves_line = document.getElementById("moves");
	score_line = document.getElementById("score");
	transcript = document.getElementById(TRANS);
	var start = document.getElementById(START);
	transcript.innerHTML = "";
	advanceStory(start);
});

function advanceStory(fragment) {
	var clone = fetchFragment(fragment);
	if (status_line !== null && clone.title !== "") {
		status_line.innerText = clone.title;
		clone.removeAttribute("title");
	}
	transcript.appendChild(clone);
	clone.scrollIntoView({behavior: "smooth"});
}

function fetchFragment(fragment) {
	var clone = fragment.cloneNode(true);
	var links = clone.getElementsByTagName("a");
	setVisited(clone);
	scoreFragment(clone);
	substCommands(clone);
	setupLinks(links);
	clone.removeAttribute("id"); // No duplicates in document.
	return clone;
}

function setVisited(fragment) {
	if (fragment.classList === undefined) {
		// Do nothing.
	} else if (fragment.classList.add === undefined) {
		// Do nothing.
	} else if (visited[fragment.id]) {
		fragment.classList.add("visited");
	} else {
		fragment.classList.add("unvisited");
	}
	visited[fragment.id] = true;
}

function scoreFragment(fragment) {
	if (fragment.dataset === undefined) {
		return;
	} else if (fragment.dataset.score === undefined) {
		return;
	} else {
		score[fragment.id] = parseInt(fragment.dataset.score);
		var total = 0;
		for (var i in score)
			total += score[i];
		if (score_line !== null)
			score_line.innerText = total;
	}
}

function setupLinks(links) {
	for (var i = 0; i < links.length; i++) {
		if (links[i].rel !== "external") {
			links[i].addEventListener("click", linkCallback);
			links[i].addEventListener("keydown", linkCallback);
		}
	}
}

function clearLinks(links) {
	for (var i = 0; i < links.length; i++) {
		if (links[i].rel !== "external") {
			clearOneLink(links[i]);
			i--;
		}
	}
}

function clearOneLink(element) {
	element.outerHTML = element.innerHTML;
}

function linkCallback(event) {
	var target_id = this.hash.slice(1);
	var target = document.getElementById(target_id);
	if (target === null) {
		alert("Broken link!");
		return;
	}
	moves++;
	if (moves_line !== null)
		moves_line.innerText = moves;
	if (this.rel === "clear") {
		transcript.innerHTML = "";
	} else if (this.rel === "continue") {
		clearLinks(transcript.getElementsByTagName("a"));
		transcript.appendChild(document.createElement("hr"));
	} else if (this.rel === "reset") {
		if (status_line !== null) status_line.innerHTML = "";
		if (moves_line !== null) moves_line.innerHTML = "0";
		if (score_line !== null) score_line.innerHTML = "0";
		
		transcript.innerHTML = "";
		moves = 0;
		score = {};
		visited = {};
	} else {
		clearOneLink(this);
	}
	advanceStory(target);
	event.preventDefault();
}

// Micro-interpreter for a very simple command language.

var variables = {};
var commands = {};
var test_flag = undefined;

function substCommands(fragment) {
	var comments = fragment.getElementsByTagName("s");
	for (var i = 0; i < comments.length; i++) {
		if (comments[i].attributes.length > 0)
			continue;
		var c = comments[i];
		var result = evalCommand(parseCommand(c.innerText));
		if (!(result instanceof Node))
			result = document.createTextNode(
				result.toString());
		c.parentNode.replaceChild(result, c);
		i--;
	}
}

function parseCommand(text) {
	return text.trim().split(/\s+/).map(parseValue);
}

function parseValue(text) {
	if (text === "#t")
		return true;
	else if (text === "#f")
		return false;
	else if (text[0] === '$')
		return variables[text.slice(1)];
	var num = parseFloat(text);
	return isNaN(num) ? text : num;
}

function evalCommand(args) {
	if (args.length === 0) {
		console.warn("Empty command!");
		return "";
	} else if (args[0] in commands) {
		return commands[args[0]].apply(null, args.slice(1));
	} else {
		console.warn("Command not found: " + args[0]);
		return "";
	}
}

commands["set"] = function (name, value) {
	variables[name] = value;
	return "";
};

commands["echo"] = function () {
	var args = Array.prototype.slice.call(arguments);
	return args.join(" ");
};

commands["test"] = function () {
	if (arguments.length === 2) {
		if (arguments[0] === "visited") {
			test_flag = arguments[1] in visited;
		} else {
			console.warn("Bad check in `test`: "
				+ arguments[0]);
			test_flag = undefined;
		}
	} else if (arguments.length === 3) {
		// Perform loose comparisons to help out authors.
		if (arguments[1] === "=" || arguments[1] === "==") {
			test_flag = arguments[0] == arguments[2];
		} else if (arguments[1] === "!=") {
			test_flag = arguments[0] != arguments[2];
		} else if (arguments[1] === "!=") {
			test_flag = arguments[0] != arguments[2];
		} else if (arguments[1] === "<") {
			test_flag = arguments[0] < arguments[2];
		} else if (arguments[1] === "<=") {
			test_flag = arguments[0] <= arguments[2];
		} else if (arguments[1] === ">") {
			test_flag = arguments[0] > arguments[2];
		} else if (arguments[1] === ">=") {
			test_flag = arguments[0] >= arguments[2];
		} else {
			console.warn("Bad comparison in `test`: "
				+ arguments[1]);
			test_flag = undefined;
		}
	} else {
		console.warn("`test` expects 2 or 3 arguments.");
		test_flag = undefined;
	}
	return "";
};

commands["iftrue"] = function () {
	if (test_flag) {
		var args = Array.prototype.slice.call(arguments);
		return evalCommand(args);
	} else {
		return "";
	}
};

commands["iffalse"] = function () {
	if (test_flag === false) {
		var args = Array.prototype.slice.call(arguments);
		return evalCommand(args);
	} else {
		// Don't take either branch in case of test error.
		return "";
	}
};

commands["include"] = function (id) {
	var target = document.getElementById(id);
	if (target !== null) {
		return fetchFragment(target);
	} else {
		console.warn("Bad include: " + id);
		return "";
	}
};

commands["incr"] = function (name, step) {
	if (!(name in variables))
		variables[name] = 0;
	variables[name] += parseFloat(step || 1);
	return "";
};

commands["decr"] = function (name, step) {
	if (!(name in variables))
		variables[name] = 0;
	variables[name] -= parseFloat(step || 1);
	return "";
};

commands["random"] = function (name) {
	variables[name] = Math.random();
	return "";
};


commands["save"] = function (name, value) {
localStorage.setItem(name, value);
return "";
};

commands["restore"] = function (name) {
value = ( localStorage.getItem(name) );
if (value === null) {
	value=0; }
variables[name] = value;
return "";
};

commands["savesession"] = function (name, value) {
sessionStorage.setItem(name, value);
return "";
};

commands["restoresession"] = function (name) {
value = ( sessionStorage.getItem(name) );
if (value === null) {
	value=0; }
variables[name] = value;
return "";
};