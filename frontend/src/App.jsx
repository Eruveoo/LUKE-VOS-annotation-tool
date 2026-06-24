import React, { useState, useEffect } from "react";
import VideoSelectionPage from "./pages/VideoSelectionPage.jsx";
import IDAssignmentPage from "./pages/IDAssignmentPage.jsx";
import MainWorkspacePage from "./pages/MainWorkspacePage.jsx";
import { testConnection, applyInitIds, getProgress } from "./api.js";

export default function App() {
  const [currentPage, setCurrentPage] = useState("video-selection");

  const [connectionStatus, setConnectionStatus] = useState(null);

  const [videoPath, setVideoPath] = useState("video_sample_5_min.mp4");

  const [runId, setRunId] = useState(null);
  const [frame0Image, setFrame0Image] = useState(null);
  const [maskAssignments, setMaskAssignments] = useState([]);

  const [resumeRunId, setResumeRunId] = useState("");

  const [idMapping, setIdMapping] = useState({});

  const [progress, setProgress] = useState({
    processed: null,
    total: null,
    percent: 0,
    fps: null,
    lastChunkSeedIdx: null,
    goldenMaxIdx: null,
  });

  useEffect(() => {
    testConnection().then((connected) => {
      setConnectionStatus(connected);
    });
  }, []);

  useEffect(() => {
    try {
      const last = window.localStorage.getItem("vos_last_run_id");
      if (last && typeof last === "string") {
        setResumeRunId(last);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleVideoLoaded = ({ videoPath: path, runId: preparedRunId }) => {
    setVideoPath(path);
    setRunId(preparedRunId);
    setCurrentPage("video-selection");
  };

  const handleInitialized = (result) => {
    setRunId(result.run_id);
    setFrame0Image(result.image);
    setMaskAssignments(result.mask_assignments);

    const initialMapping = {};
    result.mask_assignments.forEach((assignment) => {
      initialMapping[assignment.mask_index] = assignment.auto_assigned_id;
    });
    setIdMapping(initialMapping);

    setCurrentPage("id-assignment");
  };

  const handleIdsApplied = async (mapping) => {
    if (!runId) {
      return;
    }

    const validMapping = {};
    Object.entries(mapping).forEach(([maskIndex, finalId]) => {
      if (finalId !== undefined && finalId >= 1) {
        validMapping[maskIndex] = finalId;
      }
    });

    if (Object.keys(validMapping).length === 0) {
      alert("No valid IDs assigned. Please assign at least one ID.");
      return;
    }

    try {
      await applyInitIds(runId, validMapping);

      const prog = await getProgress(runId);
      setProgress({
        processed: prog.golden_processed,
        total: prog.total_frames,
        percent: prog.golden_percent || 0,
        fps: prog.fps || null,
        lastChunkSeedIdx: prog.last_chunk_seed_idx || null,
        goldenMaxIdx: prog.golden_max_idx !== null && prog.golden_max_idx !== undefined ? prog.golden_max_idx : null,
      });

      setCurrentPage("main-workspace");
    } catch (e) {
      alert(`Failed to apply IDs: ${e.message}`);
    }
  };

  const handleResumeSession = async (inputRunId) => {
    const rid = (inputRunId || "").trim();
    if (!rid) return;
    setRunId(rid);
    try {
      window.localStorage.setItem("vos_last_run_id", rid);
    } catch {
      // ignore
    }

    try {
      const prog = await getProgress(rid);
      if (prog.golden_max_idx !== null && prog.golden_max_idx !== undefined) {
        setCurrentPage("main-workspace");
      } else {
        setCurrentPage("video-selection");
      }
    } catch {
      setCurrentPage("video-selection");
    }
  };

  switch (currentPage) {
    case "video-selection":
      return (
        <VideoSelectionPage
          onVideoLoaded={handleVideoLoaded}
          onInitialized={handleInitialized}
          onResumeSession={handleResumeSession}
          connectionStatus={connectionStatus}
          defaultResumeRunId={resumeRunId}
        />
      );

    case "id-assignment":
      return (
        <IDAssignmentPage
          runId={runId}
          frame0Image={frame0Image}
          maskAssignments={maskAssignments}
          onIdsApplied={handleIdsApplied}
          onBack={() => setCurrentPage("video-selection")}
        />
      );

    case "main-workspace":
      return (
        <MainWorkspacePage
          runId={runId}
          frame0Image={frame0Image}
          onProgressUpdate={(prog) => {
            setProgress({
              processed: prog.golden_processed,
              total: prog.total_frames,
              percent: prog.golden_percent || 0,
              fps: prog.fps || null,
              lastChunkSeedIdx: prog.last_chunk_seed_idx || null,
              goldenMaxIdx: prog.golden_max_idx !== null && prog.golden_max_idx !== undefined ? prog.golden_max_idx : null,
            });
          }}
        />
      );

    default:
      return <div>Unknown page: {currentPage}</div>;
  }
}
