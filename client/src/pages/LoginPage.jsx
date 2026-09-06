import GoogleLogin from "../components/GoogleLogin";
import Logo from "../components/Logo";

function LoginPage({ onLogin }) {
  return (
    <div className="login-page">
      <main className="login-shell">
        <section className="login-card">
          <Logo size={58} />
          <div className="login-card-copy">
            <p className="eyebrow">GSQUAD</p>
            <h1>Welcome back</h1>
            <p>Sign in to continue to your conversations.</p>
          </div>
          <GoogleLogin onLogin={onLogin} />
          <p className="login-privacy">Private, focused, and built for conversation.</p>
        </section>
      </main>
    </div>
  );
}

export default LoginPage;
