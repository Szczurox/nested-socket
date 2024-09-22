require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server, {
	cors: true,
	origins: [process.env.ORIGIN, process.env.DEV_ORIGIN],
});

app.use(express.static("public"));

let rooms = new Map();

io.use(function (socket, next) {
	if (socket.handshake.auth && socket.handshake.auth.token) {
		jwt.verify(
			socket.handshake.auth.token,
			process.env.SECRET_KEY,
			function (err, decoded) {
				if (err) return next(new Error("Authentication error"));
				socket.decoded = decoded;
				next();
			}
		);
	} else return next(new Error("Authentication error"));
}).on("connection", (socket) => {
	console.log("Connection! ->", socket.id);

	const uid = socket.decoded.uid;
	const channel = socket.decoded.channel;
	const username = socket.decoded.username;
	const avatar = socket.decoded.avatar;

	const room = rooms.get(channel);

	if (room) {
		room.push(socket.id);
		rooms.set(channel, room);
	} else rooms.set(channel, [socket.id]);

	console.log("Welcome", socket.decoded.username);

	socket.on("get clients", (payload) => {
		socket.emit("all clients", room ? room : {});
	});

	socket.on("sending signal", (payload) => {
		console.log("niggerlicious", payload.clientToSignal);
		io.to(payload.clientToSignal).emit("joined", {
			signal: payload.signal,
			callerID: payload.callerID,
		});
	});

	socket.on("returning signal", (payload) => {
		io.to(payload.callerID).emit("returned signal", {
			signal: payload.signal,
			id: socket.id,
		});
	});

	socket.on("disconnect", () => {
		console.log("disconnected");
		console.log(rooms);
		rooms.set(
			channel,
			rooms.get(channel).filter((el) => el != socket.id)
		);
		console.log(rooms);
	});
});

server.listen(process.env.PORT, () => {
	console.log("listening on port:", process.env.PORT);
});
