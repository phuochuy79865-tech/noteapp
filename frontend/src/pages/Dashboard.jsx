import { useEffect, useState } from "react";
import api from "../services/api";

export default function Dashboard() {
  const [notes, setNotes] = useState([]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const fetchNotes = async () => {
    try {
     const res = await api.get("/notes");

console.log(res.data);

if (Array.isArray(res.data)) {
  setNotes(res.data);
} else if (Array.isArray(res.data.notes)) {
  setNotes(res.data.notes);
} else {
  setNotes([]);
}
    } catch (err) {
      console.log(err.response?.data);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const createNote = async () => {
    try {
      await api.post("/notes", {
        title,
        content,
      });

      setTitle("");
      setContent("");

      fetchNotes();
    } catch (err) {
      console.log(err.response?.data);
    }
  };

  const deleteNote = async (id) => {
    try {
      await api.delete(`/notes/${id}`);

      fetchNotes();
    } catch (err) {
      console.log(err.response?.data);
    }
  };

  return (
    <div className="container">
      <h1>My Notes</h1>

      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <br />

      <textarea
        placeholder="Content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <br />

      <button onClick={createNote}>
        Create Note
      </button>

      <hr />

      {notes.map((note) => (
        <div className="note-card" key={note.id}>
          <h3>{note.title}</h3>

          <p>{note.content}</p>

          <button onClick={() => deleteNote(note.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}