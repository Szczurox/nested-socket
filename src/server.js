require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server, {
	cors: true,
	origins: [
		process.env.NODE_ENV ? process.env.ORIGIN : process.env.DEV_ORIGIN,
	],
});

app.use(express.static("public"));

console.log(process.env.NODE_ENV);

let rooms = new Map();

async function disconnect(group, channel, token) {
	console.log(process.env.NODE_ENV);
	const res = await fetch(
		`${
			process.env.NODE_ENV ? process.env.ORIGIN : process.env.DEV_ORIGIN
		}/api/disconnect-peer?group=${group}&channel=${channel}`,
		{
			method: "post",
			headers: {
				"authorization": `${token}`,
			},
		}
	);
}

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
	const token = socket.decoded.token;
	const uid = socket.decoded.uid;
	const group = socket.decoded.group;
	const channel = socket.decoded.channel;
	const username = socket.decoded.username;

	console.log(`(${channel}): ${socket.id} -> Connected!`);

	const room = rooms.get(channel);

	if (room) {
		room.push(socket.id);
		rooms.set(channel, room);
	} else rooms.set(channel, [socket.id]);

	console.log(`(${channel}): Welcome ${username}!`);

	socket.on("get clients", () => {
		console.log(`(${channel}): ${socket.id} -> Getting participants`);
		socket.emit("all clients", room ? room : {});
	});

	socket.on("sending signal", (payload) => {
		console.log(
			`(${channel}): ${payload.callerID} -> ${payload.clientToSignal}: Sending signal`
		);
		io.to(payload.clientToSignal).emit("joined", {
			signal: payload.signal,
			id: socket.id,
		});
	});

	socket.on("returning signal", (payload) => {
		console.log(
			`(${channel}): ${socket.id} -> ${payload.callerID}: Returning signal`
		);
		io.to(payload.callerID).emit("returned signal", {
			signal: payload.signal,
			id: socket.id,
		});
	});

	socket.on("disconnect", () => {
		const newChannel = rooms.get(channel).filter((el) => el != socket.id);
		rooms.set(channel, newChannel);
		newChannel.forEach((clientID) => {
			io.to(clientID).emit("left", { id: socket.id });
		});
		disconnect(group, channel, token);
		console.log(`(${channel}): ${socket.id} -> Disconnected!`);
	});
});

server.listen(process.env.PORT, () => {
	console.log("listening on port:", process.env.PORT);
});
