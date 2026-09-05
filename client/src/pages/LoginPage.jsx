import GoogleLogin from "../components/GoogleLogin";

function LoginPage({ onLogin }) {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Messaging App</h1>

        <p>Sign in to continue to your conversations.</p>

        <GoogleLogin onLogin={onLogin} />
      </div>
    </div>
  );
}

export default LoginPage;