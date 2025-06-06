const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

dotenv.config();

const app = express();
const server = http.createServer(app);

// ✅ Use CORS for Express
app.use(cors());

// ✅ Create Socket.IO server with CORS config
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://webrtc-based-real-time-communication.onrender.com",
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  },
});

const emailToSocketIdMap = new Map();
const socketIdToEmailMap = new Map();

io.on("connection", (socket) => {
  console.log(`Socket Connected`, socket.id);

  socket.on("room:join", (data) => {
    const { email, room } = data;
    emailToSocketIdMap.set(email, socket.id);
    socketIdToEmailMap.set(socket.id, email);

    io.to(room).emit("user:joined", { email, id: socket.id });

    socket.join(room);
    io.to(socket.id).emit("room:join", data);
  });

  socket.on("user:call", ({ toUser, offer }) => {
    io.to(toUser).emit("incoming:call", { from: socket.id, offer });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:candidate", ({ candidate, to }) => {
    console.log("candidate", { candidate, to });
    io.to(to).emit("peer:candidate", { candidate });
  });

  socket.on("peer:negotiation", ({ to, offer }) => {
    io.to(to).emit("peer:negotiation", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });
});

// ✅ Start the server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});




// const cors = require("cors");

// const { Server } = require("socket.io");
// const dotenv = require("dotenv");
// dotenv.config();



// // ✅ Use CORS for Express
// app.use(cors());
// // ✅ Allow CORS for Socket.IO
// const io = new Server(server, {
//   cors: {
//     origin: "http://localhost:5173",
//     methods: ["GET", "POST"]
//   }
// });


// const io = new Server(process.env.PORT, {
//   cors: {
//     origin: [
//       "https://webrtc-based-real-time-communication.onrender.com",
//       "http://localhost:3000",
//     ],
//     methods: ["GET", "POST"],
//     allowedHeaders: ["Content-Type"],
//     credentials: true,
//   },
// });

// const emailToSocketIdMap = new Map();
// const socketIdToEmailMap = new Map();

// io.on("connection", (socket) => {
//   console.log(`Socket Connected`, socket.id);

//   socket.on("room:join", (data) => {
//     const { email, room } = data;
//     emailToSocketIdMap.set(email, socket.id);
//     socketIdToEmailMap.set(socket.id, email);

//     // if any user already there in room then other will join in and this user:joined event will be emit so that everyone in that room comes to knows that someone has joined
//     io.to(room).emit("user:joined", { email, id: socket.id });

//     // join that person
//     socket.join(room);

//     //server send this emit event to this particualar (to) person(socket.id)
//     io.to(socket.id).emit("room:join", data);
//   });

//   socket.on("user:call", ({ toUser, offer }) => {
//     // console.log("user:call", toUser, " ", offer);

//     // send the offer of the user who call to the user whom to be called
//     // socket.id is current user
//     io.to(toUser).emit("incoming:call", { from: socket.id, offer });
//   });

//   socket.on("call:accepted", ({ to, ans }) => {
//     io.to(to).emit("call:accepted", { from: socket.id, ans });
//   });

//   socket.on("peer:candidate", ({ candidate, to }) => {
//     console.log("candidate", { candidate, to });
//     io.to(to).emit("peer:candidate", { candidate });
//   });

//   socket.on("peer:negotiation", ({ to, offer }) => {
//     io.to(to).emit("peer:negotiation", { from: socket.id, offer });
//   });

//   socket.on("peer:nego:done", ({ to, ans }) => {
//     io.to(to).emit("peer:nego:final", { from: socket.id, ans });
//   });
// });
