import React, { useRef, useEffect, useState } from "react";
import WebViewer from "@pdftron/webviewer";
import io from "socket.io-client";
import { useLocation } from "react-router-dom";
import "./App.css";

const socket = io("http://localhost:3001");

const App = () => {
  const viewer = useRef(null);
  const location = useLocation();
  const [instance, setInstance] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [roomId, setRoomId] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");

  useEffect(() => {
    WebViewer(
      {
        path: "/webviewer/lib",
        licenseKey: "demo:1740855707275:614929260300000000ba0af63ff8f99ffbe49c042ca80c5f78b790cd57",
      },
      viewer.current
    ).then((instance) => {
      setInstance(instance);
      const { documentViewer, annotationManager } = instance.Core;

      documentViewer.addEventListener("documentLoaded", async () => {
        annotationManager.setCurrentUser(userRole);

        annotationManager.addEventListener("annotationChanged", async (changes, action) => {
          if (action === "add" || action === "modify" || action === "delete") {
            const xfdfString = await annotationManager.exportAnnotations();
            if (roomId) {
              console.log(`📌 Emitting annotation update from ${userRole}`);
              socket.emit("annotationUpdate", { roomId, xfdfString });
            }
          }
        });
      });

      // Load document when received from server
      socket.on("documentSelected", ({ fileUrl }) => {
        if (!fileUrl) return;
        console.log(`📄 Loading document: ${fileUrl}`);
        setDocumentUrl(fileUrl);
        instance.UI.loadDocument(fileUrl);
      });

      // Apply annotations when received from server
      socket.on("annotationUpdate", async ({ xfdfString }) => {
        console.log("📌 Applying received annotations...");
        await annotationManager.importAnnotations(xfdfString);
      });

      // Close room if host leaves
      socket.on("roomClosed", () => {
        alert("🚨 The host has left. The room is now closed.");
        setRoomId("");
        setDocumentUrl("");
      });
    });

    return () => socket.off();
  }, [userRole]);

  useEffect(() => {
    const pathParts = location.pathname.split("/");
    if (pathParts[1] === "join" && pathParts[2]) {
      const extractedRoomId = pathParts[2];
      setRoomId(extractedRoomId);
      setUserRole("sub");
      socket.emit("joinRoom", extractedRoomId);
    }
  }, [location]);

  const createRoom = () => {
    socket.emit("createRoom");
    socket.on("roomCreated", ({ roomId }) => {
      setRoomId(roomId);
      setUserRole("master");
      console.log(`✅ Room Created: ${roomId}`);
    });
  };

  const handleFileChange = async (event) => {
    if (userRole !== "master" || !roomId) return;

    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }

    const fileUrl = URL.createObjectURL(selectedFile);
    setDocumentUrl(fileUrl);
    socket.emit("documentSelected", { roomId, fileUrl });
  };

  return (
    <div className="App">
      <div className="header">React PDF Collaboration</div>

      {!userRole && (
        <div>
          <label>Select User Role: </label>
          <button onClick={() => setUserRole("master")}>Master</button>
          <button onClick={() => setUserRole("sub")}>Sub User</button>
        </div>
      )}

      {userRole && (
        <>
          <p>Logged in as: {userRole.toUpperCase()}</p>

          {userRole === "master" && !roomId && (
            <button onClick={createRoom}>Create Room</button>
          )}

          {roomId && userRole === "master" && (
            <div>
              <p>Share this link: <b>{window.location.origin}/join/{roomId}</b></p>
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${roomId}`)}>
                Copy Link
              </button>
            </div>
          )}

          {userRole === "master" && roomId && <input type="file" onChange={handleFileChange} />}
          <div className="webviewer" ref={viewer}></div>
        </>
      )}
    </div>
  );
};

export default App;
