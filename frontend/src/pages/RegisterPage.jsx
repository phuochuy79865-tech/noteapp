import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRegister = async () => {
    try {
      const res = await api.post("/auth/register", {
        displayName,
        email,
        password,
        confirmPassword,
      });

      console.log(res.data);

      alert("Register success");

      navigate("/");
    } catch (err) {
      console.log(err.response?.data);

      alert("Register failed");
    }
  };

  return (
    <div className="container">
      <h1>Register</h1>

      <input
        type="text"
        placeholder="Display Name"
        onChange={(e) => setDisplayName(e.target.value)}
      />

      <br />

      <input
        type="email"
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />

      <br />

      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
      />

      <br />

      <input
        type="password"
        placeholder="Confirm Password"
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      <br />

      <button onClick={handleRegister}>
        Register
      </button>

      <p>
        Already have account? <Link to="/">Login</Link>
      </p>
    </div>
  );
}