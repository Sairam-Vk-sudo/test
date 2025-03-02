import React, { useRef, useEffect, useState } from "react";
import WebViewer from "@pdftron/webviewer";
import io from "socket.io-client";
import gzip from "gzip-js";
import "./App.css";

const socket = io("http://localhost:3001");

const App = () => {
  const viewer = useRef(null);
  const [instance, setInstance] = useState(null);
  const [userRole, setUserRole] = useState(""); // "master" or "sub"
  const [documentUrl, setDocumentUrl] = useState("");

  // Handle file selection (Only Master User Can Select)
  const handleFileChange = async (event) => {
    if (userRole !== "master") return;

    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    const fileUrl = URL.createObjectURL(selectedFile);
    localStorage.setItem("selectedDocument", fileUrl);

    // Notify other users
    socket.emit("documentSelected", { fileUrl });
    setDocumentUrl(fileUrl);
  };

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

      documentViewer.addEventListener("documentLoaded", () => {
        annotationManager.setCurrentUser(userRole);
      });

      // ✅ Correctly Send Annotations with User Role
      annotationManager.addEventListener("annotationChanged", async (annotations, action) => {
        if (action === "add" || action === "modify") {
          const xfdfString = await annotationManager.exportAnnotations();
          socket.emit("annotationUpdate", { xfdfString, userRole });
        }
      });

      // 📌 Listen for Master Selecting Document
      socket.on("documentSelected", ({ fileUrl }) => {
        console.log(`Master selected document: ${fileUrl}`);
        localStorage.setItem("selectedDocument", fileUrl);
        setDocumentUrl(fileUrl);
        instance.UI.loadDocument(fileUrl);
      });

      // 📌 Listen for Annotation Updates & Apply to All Users
      socket.on("annotationUpdate", async ({ xfdfString }) => {
        console.log("Applying received annotations...");
        await annotationManager.importAnnotations(xfdfString);
      });

      // Load previous document if available
      const savedDoc = localStorage.getItem("selectedDocument");
      if (savedDoc) {
        setDocumentUrl(savedDoc);
        instance.UI.loadDocument(savedDoc);
      }
    });
  }, [userRole]);

  return (
    <div className="App">
      <div className="header">React PDF Collaboration</div>

      {/* User Role Selection - Mandatory */}
      {!userRole && (
        <div>
          <label>Select User Role: </label>
          <button onClick={() => setUserRole("master")}>Master</button>
          <button onClick={() => setUserRole("sub")}>Sub User</button>
        </div>
      )}

      {/* Show interface only after role selection */}
      {userRole && (
        <>
          <p>Logged in as: {userRole.toUpperCase()}</p>

          {/* Only Master Can Select Document */}
          {userRole === "master" && <input type="file" onChange={handleFileChange} />}

          <div className="webviewer" ref={viewer}></div>
        </>
      )}
    </div>
  );
};

export default App;
