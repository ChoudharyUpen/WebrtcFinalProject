//working / writing code in this page you will improve the videocall page of this project

import React, { useCallback, useEffect, useRef, useState } from "react";
 import { useSocket } from "../context/SocketProvider";
import PeerServices from "../services/Peer"; // Import as a class

import './room1.css';
const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [videoEnable, setVideoEnabled] = useState(true);
  const [audioEnable, setAudioEnable] = useState(true);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]); // State to store chat messages
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [sendingFiles, setSendingFiles] = useState([]); // Track files being sent

  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const myStream = useRef(null);

  // Callback to add received messages to the chat
  const handleReceivedMessage = (message) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { text: message, fromSelf: false },
    ]);
  };

  const handleReceivedFile = useCallback((data) => {
    // Check if data is a string (metadata) or ArrayBuffer (file data)
    if (typeof data === "string") {
      // Attempt to parse it as JSON metadata
      try {
        const metadata = JSON.parse(data);
        if (metadata.fileName && metadata.fileSize) {
          setReceivedFiles((prev) => [
            ...prev,
            {
              url: null,
              name: metadata.fileName,
              size: metadata.fileSize,
              receivedData: [],
              receivedSize: 0, // Track received bytes
              progress: 0, // Track progress percentage
            },
          ]);
          return;
        }
      } catch (e) {
        console.error("Failed to parse metadata:", e);
      }
    } else if (data instanceof ArrayBuffer) {
      // Add binary data (file chunk) to the last file entry in receivedFiles
      setReceivedFiles((prev) => {
        const lastFileIndex = prev.length - 1;
        if (lastFileIndex >= 0) {
          const updatedFiles = [...prev];
          const lastFile = { ...updatedFiles[lastFileIndex] };

          // Add the new chunk
          lastFile.receivedData.push(data);

          // Update received size and progress
          const chunkSize = data.byteLength;
          lastFile.receivedSize = (lastFile.receivedSize || 0) + chunkSize;
          lastFile.progress = Math.round(
            (lastFile.receivedSize / lastFile.size) * 100
          );

          updatedFiles[lastFileIndex] = lastFile;
          return updatedFiles;
        }
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      receivedFiles.forEach((file) => {
        if (file.url) URL.revokeObjectURL(file.url);
      });
    };
  }, [receivedFiles]);

  // Handle file sending progress
  const handleFileSendProgress = useCallback(
    (fileName, sentBytes, totalBytes) => {
      setSendingFiles((prev) => {
        const fileIndex = prev.findIndex((f) => f.name === fileName);

        if (fileIndex >= 0) {
          const updatedFiles = [...prev];
          updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            sentBytes,
            progress: Math.round((sentBytes / totalBytes) * 100),
          };
          return updatedFiles;
        } else {
          return [
            ...prev,
            {
              name: fileName,
              size: totalBytes,
              sentBytes,
              progress: Math.round((sentBytes / totalBytes) * 100),
            },
          ];
        }
      });
    },
    []
  );

  // Instantiate PeerServices with the callbacks
  const [peer] = useState(
    new PeerServices(
      handleReceivedMessage,
      handleReceivedFile,
      handleFileSendProgress
    )
  );

  const addMessage = (text, fromSelf) => {
    setMessages((prevMessages) => [...prevMessages, { text, fromSelf }]);
  };

  const toggleVideo = () => {
    if (myStream.current) {
      myStream.current
        .getVideoTracks()
        .forEach((track) => (track.enabled = !track.enabled));
      setVideoEnabled((prev) => !prev);
    }
  };

  const toggleAudio = () => {
    if (myStream.current) {
      myStream.current
        .getAudioTracks()
        .forEach((track) => (track.enabled = !track.enabled));
      setAudioEnable((prev) => !prev);
    }
  };

  const handleUserJoined = useCallback(({ email, id }) => {
    setRemoteSocketId(id);
    addMessage(`${email} has joined the room.`, false);
  }, []);

  const handleUserCall = useCallback(async () => {
    try {
      const offer = await peer.getCompleteOffer();
      socket.emit("user:call", { toUser: remoteSocketId, offer });
    } catch (error) {
      console.error("Error initiating call:", error);
    }
  }, [peer, remoteSocketId, socket]);

  const handleIncomingCall = useCallback(
    async ({ from, offer }) => {
      try {
        setRemoteSocketId(from);
        const answer = await peer.getAnswer(offer);
        socket.emit("call:accepted", { to: from, ans: answer });
      } catch (error) {
        console.error("Error handling incoming call:", error);
      }
    },
    [peer, socket]
  );

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
    },
    [peer]
  );

  const handleNegotiation = useCallback(async () => {
    const offer = await peer.getCompleteOffer();
    socket.emit("peer:negotiation", { offer, to: remoteSocketId });
  }, [peer, remoteSocketId, socket]);

  const handleIncomingNegotiation = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [peer, socket]
  );

  const handleNegotiationFinal = useCallback(
    async ({ ans }) => {
      await peer.setLocalDescription(ans);
    },
    [peer]
  );

  const handleIceCandidate = useCallback(
    ({ candidate }) => {
      if (candidate) {
        peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
    },
    [peer]
  );

  useEffect(() => {
    const onIceCandidate = (event) => {
      if (event.candidate) {
        socket.emit("peer:candidate", {
          candidate: event.candidate,
          to: remoteSocketId,
        });
      }
    };

    peer.peer.onicecandidate = onIceCandidate;
    return () => {
      peer.peer.onicecandidate = null;
    };
  }, [peer, socket, remoteSocketId]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegotiation);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegotiation);
    };
  }, [peer, handleNegotiation]);

  useEffect(() => {
    peer.peer.addEventListener("track", (ev) => {
      const [stream] = ev.streams;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    });
  }, [peer]);

  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        myStream.current = stream;
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;
        stream.getTracks().forEach((track) => {
          peer.peer.addTrack(track, stream);
        });
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };

    initMedia();

    return () => {
      myStream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [peer]);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incoming:call", handleIncomingCall);
    socket.on("peer:candidate", handleIceCandidate);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:negotiation", handleIncomingNegotiation);
    socket.on("peer:nego:final", handleNegotiationFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incoming:call", handleIncomingCall);
      socket.off("peer:candidate", handleIceCandidate);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:negotiation", handleIncomingNegotiation);
      socket.off("peer:nego:final", handleNegotiationFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncomingCall,
    handleIceCandidate,
    handleCallAccepted,
    handleIncomingNegotiation,
    handleNegotiationFinal,
  ]);

  const handleSendMessage = () => {
    peer.sendMessage(message);
    addMessage(message, true); // Add message to chat as from self
    setMessage("");
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Add the file to sending files list with initial progress of 0%
      setSendingFiles((prev) => [
        ...prev,
        {
          name: file.name,
          size: file.size,
          sentBytes: 0,
          progress: 0,
        },
      ]);

      peer.sendFile(file);
    }
  };

// Progress bar component
const ProgressBar = ({ progress }) => {
  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "#e0e0e0",
        borderRadius: "10px",
        margin: "8px 0",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)",
      }}>
      <div
        style={{
          height: "12px",
          width: `${progress}%`,
          background: "linear-gradient(to right, #4CAF50, #81C784)",
          borderRadius: "10px",
          transition: "width 0.4s ease-in-out",
        }}
      />
    </div>
  );
};

return (
  <div
    style={{
      fontFamily: "Segoe UI, sans-serif",
      padding: "20px",
      background: "#f4f6f8",
      minHeight: "100vh",
      color: "#333",
    }}
  >
    <h1 style={{ fontSize: "2.5rem", marginBottom: "10px" }}>Room Page</h1>
    <h2 style={{ color: remoteSocketId ? "#28a745" : "#dc3545" }}>
      {remoteSocketId ? "Connected" : "No one in room"}
    </h2>
    {remoteSocketId && (
      <button
        className="callbutton"
        onClick={handleUserCall}
        style={{
          backgroundColor: "#ffc107",
          border: "none",
          padding: "10px 20px",
          margin: "10px 0",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Incomming - Call
      </button>
    )}

    <div className="video-container" style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "20px" }}>
      <div className="video-block" style={{ flex: "1", minWidth: "300px" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "10px" }}>My Stream</h1>
        <video
          playsInline
          autoPlay
          height="500px"
          width="700px"
          style={{
            transform: "scaleX(-1)",
            borderRadius: "20px",
            border: "4px solid #007bff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
          }}
          ref={myVideoRef}
        />

        <div style={{ marginTop: "15px" }}>
          <button className="callbutton" onClick={toggleVideo} style={{ marginRight: "10px" }}>
            {videoEnable ? "Turn off video" : "Turn on video"}
          </button>
          <button className="callbutton" onClick={toggleAudio}>
            {audioEnable ? "Turn off audio" : "Turn on audio"}
          </button>
        </div>
      </div>

      {remoteSocketId && (
        <div className="video-block" style={{ flex: "1", minWidth: "300px" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "10px" }}>Remote Stream</h1>
          <video
            playsInline
            autoPlay
            height="500px"
            width="700px"
            style={{
              transform: "scaleX(-1)",
              borderRadius: "20px",
              border: "4px solid #28a745",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
            }}
            ref={remoteVideoRef}
          />
        </div>
      )}
    </div>

    {remoteSocketId && (
      <div style={{ marginTop: "30px" }}>
        <h2 style={{ fontSize: "2rem", marginBottom: "15px" }}>Chat</h2>
        <div className="chat-box" style={{ maxHeight: "300px", overflowY: "auto", padding: "10px", background: "#fff", borderRadius: "10px", border: "1px solid #ccc" }}>
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                border: "1px solid #ccc",
                textAlign: msg.fromSelf ? "right" : "left",
                backgroundColor: msg.fromSelf ? "#DFF6FF" : "#E8DAFF",
                padding: "10px",
                borderRadius: "10px",
                margin: "6px 0",
                maxWidth: "70%",
                alignSelf: msg.fromSelf ? "flex-end" : "flex-start",
                marginLeft: msg.fromSelf ? "auto" : "0",
              }}>
              {msg.text}
            </div>
          ))}
        </div>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter message"
          style={{ padding: "10px", width: "70%", marginTop: "10px", borderRadius: "6px", border: "1px solid #ccc" }}
        />

<button 
  onClick={handleSendMessage}
  style={{
    marginLeft: "10px",
    padding: "10px 15px",
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer"
  }}
>
  Send Message
</button>

<div style={{ marginTop: "30px" }}>
  <h2 style={{ marginBottom: "10px" }}>File Sharing</h2>

  <label
    style={{
      display: "inline-block",
      padding: "10px 15px",
      backgroundColor: "#007bff",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer"
    }}
  >
    Choose File
    <input
      type="file"
      onChange={handleFileSelect}
      style={{ display: "none" }}
    />
  </label>
</div>

        {/* <button
          onClick={handleSendMessage}
          style={{
            marginLeft: "10px",
            padding: "10px 15px",
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Send Message
        </button>

        <div style={{ marginTop: "30px" }}>
          <h2 style={{ marginBottom: "10px" }}>File Sharing</h2>
          <input type="file" onChange={handleFileSelect} />
        </div> */}

        {sendingFiles.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <h3 style={{ color: "#007bff" }}>Sending Files</h3>
            {sendingFiles.map((file, index) => (
              <div key={`sending-${index}`} style={{ margin: "12px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                  <span>{file.name}</span>
                  <span>{file.progress}%</span>
                </div>
                <ProgressBar progress={file.progress} />
                {file.progress === 100 && (
                  <span style={{ color: "green", fontWeight: "bold" }}>Sent successfully!</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "30px" }}>
          <h3 style={{ color: "#28a745" }}>Received Files</h3>
          {receivedFiles.map((file, index) => {
            let fileUrl = file.url;
            if (!fileUrl && file.receivedData && file.progress === 100) {
              const fileBlob = new Blob(file.receivedData);
              fileUrl = URL.createObjectURL(fileBlob);
              setReceivedFiles((prev) => {
                const updated = [...prev];
                updated[index] = { ...updated[index], url: fileUrl };
                return updated;
              });
            }

            return (
              <div key={`receiving-${index}`} style={{ margin: "12px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                  <span>{file.name}</span>
                  <span>{file.progress || 0}%</span>
                </div>
                <ProgressBar progress={file.progress || 0} />
                {fileUrl && (
                  <a href={fileUrl} download={file.name} style={{ color: "#007bff", textDecoration: "underline" }}>
                    Download {file.name}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>
);





  // Progress bar component
// Progress bar component
// const ProgressBar = ({ progress }) => {
//   return (
//     <div
//       style={{
//         width: "100%",
//         background: "linear-gradient(to right, #f0f0f0, #e0e0e0)",
//         borderRadius: "10px",
//         margin: "8px 0",
//         height: "14px",
//         boxShadow: "inset 0 2px 5px rgba(0,0,0,0.15)",
//       }}>
//       <div
//         style={{
//           height: "100%",
//           width: `${progress}%`,
//           background: "linear-gradient(to right, #00c6ff, #0072ff)",
//           borderRadius: "10px",
//           transition: "width 0.4s ease-in-out",
//         }}
//       />
//     </div>
//   );
// };

// return (
//   <div style={{ padding: "24px", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", backgroundColor: "#fdfdfd" }}>
//     <h1 style={{ textAlign: "center", color: "#222", fontWeight: "600", marginBottom: "16px" }}>Room Page</h1>
//     <h2 style={{ textAlign: "center", color: remoteSocketId ? "#00C853" : "#D50000", fontWeight: "500" }}>
//       {remoteSocketId ? "Connected" : "No one in room"}
//     </h2>
//     {remoteSocketId && (
//       <button
//         className="callbutton"
//         onClick={handleUserCall}
//         style={{
//           display: "block",
//           margin: "16px auto",
//           padding: "10px 24px",
//           background: "linear-gradient(to right, #FF512F, #DD2476)",
//           color: "#fff",
//           border: "none",
//           borderRadius: "8px",
//           fontWeight: "bold",
//           letterSpacing: "1px",
//           cursor: "pointer",
//           boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
//         }}>
//         Incoming - Call
//       </button>
//     )}

//     {/* Video Section */}
//     <div className="video-container" style={{ display: "flex", flexWrap: "wrap", gap: "24px", justifyContent: "center", marginTop: "20px" }}>
//       <div className="video-block" style={{ textAlign: "center" }}>
//         <h1 style={{ marginBottom: "12px", fontSize: "20px", color: "#444" }}>My Stream</h1>
//         <video
//           playsInline
//           autoPlay
//           height="500px"
//           width="700px"
//           style={{
//             transform: "scaleX(-1)",
//             borderRadius: "20px",
//             boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
//             border: "2px solid #ccc",
//           }}
//           ref={myVideoRef}
//         />
//         <div style={{ marginTop: "14px" }}>
//           <button
//             className="callbutton"
//             onClick={toggleVideo}
//             style={{
//               margin: "6px",
//               padding: "8px 20px",
//               backgroundColor: "#FF5722",
//               color: "#fff",
//               border: "none",
//               borderRadius: "6px",
//               fontWeight: "bold",
//               cursor: "pointer",
//               boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
//             }}>
//             {videoEnable ? "Turn off video" : "Turn on video"}
//           </button>
//           <button
//             className="callbutton"
//             onClick={toggleAudio}
//             style={{
//               margin: "6px",
//               padding: "8px 20px",
//               backgroundColor: "#673AB7",
//               color: "#fff",
//               border: "none",
//               borderRadius: "6px",
//               fontWeight: "bold",
//               cursor: "pointer",
//               boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
//             }}>
//             {audioEnable ? "Turn off audio" : "Turn on audio"}
//           </button>
//         </div>
//       </div>

//       {remoteSocketId && (
//         <div className="video-block" style={{ textAlign: "center" }}>
//           <h1 style={{ marginBottom: "12px", fontSize: "20px", color: "#444" }}>Remote Stream</h1>
//           <video
//             playsInline
//             autoPlay
//             height="500px"
//             width="700px"
//             style={{
//               transform: "scaleX(-1)",
//               borderRadius: "20px",
//               boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
//               border: "2px solid #ccc",
//             }}
//             ref={remoteVideoRef}
//           />
//         </div>
//       )}
//     </div>

//     {/* Chat */}
//     {remoteSocketId && (
//       <div style={{ marginTop: "40px" }}>
//         <h2 style={{ color: "#444" }}>Chat</h2>
//         <div
//           className="chat-box"
//           style={{
//             display: "flex",
//             flexDirection: "column",
//             maxHeight: "260px",
//             overflowY: "auto",
//             border: "1px solid #ccc",
//             padding: "12px",
//             borderRadius: "12px",
//             background: "#fefefe",
//             marginBottom: "12px",
//           }}>
//           {messages.map((msg, index) => (
//             <div
//               key={index}
//               style={{
//                 textAlign: msg.fromSelf ? "right" : "left",
//                 background: msg.fromSelf ? "#C1F4FF" : "#E5D1FF",
//                 padding: "10px",
//                 borderRadius: "10px",
//                 margin: "4px 0",
//                 fontSize: "14px",
//                 maxWidth: "65%",
//                 alignSelf: msg.fromSelf ? "flex-end" : "flex-start",
//                 boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
//               }}>
//               {msg.text}
//             </div>
//           ))}
//         </div>
//         <div style={{ display: "flex", gap: "10px" }}>
//           <input
//             type="text"
//             value={message}
//             onChange={(e) => setMessage(e.target.value)}
//             placeholder="Type your message..."
//             style={{
//               flex: 1,
//               padding: "10px",
//               borderRadius: "8px",
//               border: "1px solid #bbb",
//               outline: "none",
//               fontSize: "14px",
//             }}
//           />
//           <button
//             onClick={handleSendMessage}
//             style={{
//               padding: "10px 20px",
//               background: "linear-gradient(to right, #00b09b, #96c93d)",
//               color: "#fff",
//               fontWeight: "bold",
//               border: "none",
//               borderRadius: "8px",
//               cursor: "pointer",
//               boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
//             }}>
//             Send
//           </button>
//         </div>

//         {/* File Sharing */}
//         <div style={{ marginTop: "30px" }}>
//           <h2>File Sharing</h2>
//           <input type="file" onChange={handleFileSelect} />
//         </div>

//         {/* Sending Files */}
//         {sendingFiles.length > 0 && (
//           <div style={{ marginTop: "20px" }}>
//             <h3>Sending Files</h3>
//             {sendingFiles.map((file, index) => (
//               <div key={`sending-${index}`} style={{ margin: "10px 0" }}>
//                 <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
//                   <span>{file.name}</span>
//                   <span>{file.progress}%</span>
//                 </div>
//                 <ProgressBar progress={file.progress} />
//                 {file.progress === 100 && (
//                   <span style={{ color: "#2E7D32", fontSize: "13px" }}>Sent successfully!</span>
//                 )}
//               </div>
//             ))}
//           </div>
//         )}

//         {/* Received Files */}
//         <div style={{ marginTop: "20px" }}>
//           <h3>Received Files</h3>
//           {receivedFiles.map((file, index) => {
//             let fileUrl = file.url;
//             if (!fileUrl && file.receivedData && file.progress === 100) {
//               const fileBlob = new Blob(file.receivedData);
//               fileUrl = URL.createObjectURL(fileBlob);
//               setReceivedFiles((prev) => {
//                 const updated = [...prev];
//                 updated[index] = { ...updated[index], url: fileUrl };
//                 return updated;
//               });
//             }

//             return (
//               <div key={`receiving-${index}`} style={{ margin: "10px 0" }}>
//                 <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
//                   <span>{file.name}</span>
//                   <span>{file.progress || 0}%</span>
//                 </div>
//                 <ProgressBar progress={file.progress || 0} />
//                 {fileUrl && (
//                   <a
//                     href={fileUrl}
//                     download={file.name}
//                     style={{
//                       display: "inline-block",
//                       marginTop: "6px",
//                       textDecoration: "none",
//                       color: "#007BFF",
//                       fontWeight: "bold",
//                     }}>
//                     Download {file.name}
//                   </a>
//                 )}
//               </div>
//             );
//           })}
//         </div>
//       </div>
//     )}
//   </div>
// );

};

export default RoomPage;






   //Progress bar component
//   const ProgressBar = ({ progress }) => {
//     return (
//       <div
//         style={{
//           width: "100%",
//           backgroundColor: "#e0e0e0",
//           borderRadius: "4px",
//           margin: "5px 0",
//         }}>
//         <div
//           style={{
//             height: "10px",
//             width: `${progress}%`,
//             backgroundColor: "#4CAF50",
//             borderRadius: "4px",
//             transition: "width 0.3s ease",
//           }}
//         />
//       </div>
//     );
//   };


//   return (
//     <div>
//       <h1>Room Page</h1>
//       <h2>{remoteSocketId ? "Connected" : "No one in room"}</h2>
//       {remoteSocketId && (
//         <button className="callbutton" onClick={handleUserCall}>Incomming - Call</button>
//       )}
// {/* /////////////////////////////////////////////////////////// */}
    
//       <div className="video-container">
//       <div className="video-block">
//         <h1>My Stream</h1>
//         <video
//           playsInline
//           autoPlay
//           height="500px"
//           width="700px"
//           style={{ transform: "scaleX(-1)",
//             borderRadius: "50px" // 🟢 Rounded corners
//            }}
//           ref={myVideoRef}
//         />
    
//       <div>
//         <button className="callbutton" onClick={toggleVideo}>
//           {videoEnable ? "Turn off video" : "Turn on video"}
//         </button>
//         <button className="callbutton" onClick={toggleAudio}>
//           {audioEnable ? "Turn off audio" : "Turn on audio"}
//         </button>
//       </div>
//       </div>
// {/* /////////////////////////////////////////////////////////// */}
//       {remoteSocketId && (
//           <div className="video-block">
//           <h1>Remote Stream</h1>
//           <video
//             playsInline
//             autoPlay
//             height="500px"
//             width="700px"
//             style={{ transform: "scaleX(-1)",
//               borderRadius: "50px" // 🟢 Rounded corners
//              }}
            
//             ref={remoteVideoRef}
//           />
//         </div>
//       )}
//         </div>

// {/* ///////////////////////////////////////////////////////////// */}
//       {remoteSocketId && (
//         <div>
//           <h2>Chat</h2>
//           <div className="chat-box">
//             {messages.map((msg, index) => (
//               <div
//                 key={index}
//                 style={{
//                   border: "1px solid black",
//                   textAlign: msg.fromSelf ? "right" : "left",
//                   backgroundColor: msg.fromSelf ? "#BFECFF" : "#CDC1FF",
//                   padding: "5px",
//                   borderRadius: "8px",
//                   margin: "5px",
//                   maxWidth: "50%",
//                   alignSelf: msg.fromSelf ? "flex-end" : "flex-start",
//                 }}>
//                 {msg.text}
//               </div>
//             ))}
//           </div>
//           <input
//             type="text"
//             value={message}
//             onChange={(e) => setMessage(e.target.value)}
//             placeholder="Enter message"
//           />
//           <button onClick={handleSendMessage}>Send Message</button>
          
          
// {/* /////////////////////////////////////////////////////////// */}   
//           <div>
//             <h2>File Sharing</h2>
//             <input type="file" onChange={handleFileSelect} />
//           </div>

// {/* /////////////////////////////////////////////////////////// */}
//           {/* Sending Files Progress Section */}
//           {sendingFiles.length > 0 && (
//             <div>
//               <h3>Sending Files</h3>
//               {sendingFiles.map((file, index) => (
//                 <div key={`sending-${index}`} style={{ margin: "10px 0" }}>
//                   <div
//                     style={{
//                       display: "flex",
//                       justifyContent: "space-between",
//                     }}>
//                     <span>{file.name}</span>
//                     <span>{file.progress}%</span>
//                   </div>
//                   <ProgressBar progress={file.progress} />
//                   {file.progress === 100 && (
//                     <span style={{ color: "green" }}>Sent successfully!</span>
//                   )}
//                 </div>
//               ))}
//             </div>
//           )}

// {/* /////////////////////////////////////////////////////////// */}
//           {/* Received Files Section */}
//           <div>
//             <h3>Received Files</h3>
//             {receivedFiles.map((file, index) => {
//               // Create file URL for completed transfers
//               let fileUrl = file.url;
//               if (!fileUrl && file.receivedData && file.progress === 100) {
//                 const fileBlob = new Blob(file.receivedData);
//                 fileUrl = URL.createObjectURL(fileBlob);
//                 // Update the file object with the URL
//                 setReceivedFiles((prev) => {
//                   const updated = [...prev];
//                   updated[index] = { ...updated[index], url: fileUrl };
//                   return updated;
//                 });
//               }

//               return (
//                 <div key={`receiving-${index}`} style={{ margin: "10px 0" }}>
//                   <div
//                     style={{
//                       display: "flex",
//                       justifyContent: "space-between",
//                     }}>
//                     <span>{file.name}</span>
//                     <span>{file.progress || 0}%</span>
//                   </div>
//                   <ProgressBar progress={file.progress || 0} />
//                   {fileUrl && (
//                     <a href={fileUrl} download={file.name}>
//                       Download {file.name}
//                     </a>
//                   )}
//                 </div>
//               );
//             })}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default RoomPage;




