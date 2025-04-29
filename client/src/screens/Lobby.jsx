import React, { useEffect, useCallback, useState } from "react";
import { useSocket } from "../context/SocketProvider";
import { useNavigate } from "react-router-dom";

const LobbyScreen = () => {
  const [email, setEmail] = useState("");
  const [room, setRoom] = useState("");
  const navigate = useNavigate();
  const socket = useSocket();

  const handleSubmitForm = useCallback(
    (e) => {
      e.preventDefault();
      socket.emit("room:join", { email, room });
    },
    [email, room, socket]
  );

  const handleJoin = useCallback((data) => {
    const { room } = data;
    navigate(`/room/${room}`);
  }, []);

  useEffect(() => {
    socket.on("room:join", handleJoin);
    return () => {
      socket.off("room:join", handleJoin);
    };
  }, [socket]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
        background: "linear-gradient(to right, #667eea, #764ba2)",
        color: "#fff",
      }}
    >
      <h1 style={{ fontSize: "3rem", marginBottom: "2rem" }}>🚀 Join Lobby</h1>
      <form
        onSubmit={handleSubmitForm}
        style={{
          backgroundColor: "rgba(0,0,0,0.3)",
          padding: "2rem",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          minWidth: "300px",
        }}
      >
        <label htmlFor="email" style={{ display: "block", marginBottom: "8px" }}>
          📧 Email ID
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "none",
            marginBottom: "1rem",
          }}
        />

        <label htmlFor="room" style={{ display: "block", marginBottom: "8px" }}>
          🔢 Room Number
        </label>
        <input
          type="text"
          id="room"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "none",
            marginBottom: "1.5rem",
          }}
        />

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#00c6ff",
            color: "#fff",
            fontWeight: "bold",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "background-color 0.3s",
          }}
        >
          Join Room 🚪
        </button>
      </form>
    </div>
  );
};

export default LobbyScreen;






// import React, { useEffect, useCallback, useState} from "react";
// import { useSocket } from "../context/SocketProvider";
// import { useNavigate } from "react-router-dom";

// const LobbyScreen = () => {
//   const [email, setEmail] = useState("");
//   const [room, setRoom] = useState("");
//   const navigate = useNavigate();
//   const socket = useSocket();

//   const handleSubmitForm = useCallback(
//     (e) => {
//       e.preventDefault();
//       socket.emit("room:join", { email, room });
//     },
//     [email, room, socket]
//   );

//   const handleJoin = useCallback((data) => {
//     const { room } = data;
//     navigate(`/room/${room}`);
//   }, []);

//   useEffect(() => {
//     socket.on("room:join", handleJoin);
//     return () => {
//       socket.off("room:join", handleJoin);
//     };
//   }, [socket]);

//   return (
//     <>
//       <h1>Lobby</h1>
//       <form onSubmit={handleSubmitForm}>
//         <label htmlFor="email">Email ID</label>
//         <input
//           type="email"
//           id="email"
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//         />
//         <br />

//         <label htmlFor="room">Room Number</label>
//         <input
//           type="text"
//           id="room"
//           value={room}
//           onChange={(e) => setRoom(e.target.value)}
//         />
//         <br />

//         <button type="submit">Join</button>
//       </form>
//     </>
//   );
// };

// export default LobbyScreen;
