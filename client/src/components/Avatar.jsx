function Avatar({ user, name, size = "medium", online = false }) {
  const displayName = user?.name ?? name ?? "Conversation";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  const colorSeed = `${user?.id ?? ""}:${displayName}`
    .split("")
    .reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
  const hue = colorSeed % 360;
  const generatedStyle = {
    background: `linear-gradient(145deg, hsl(${hue} 62% 52%), hsl(${(hue + 22) % 360} 68% 40%))`,
    color: "#fff",
  };

  return (
    <span className={`avatar avatar-${size}`} style={generatedStyle} aria-hidden="true">
      <span>{initial}</span>
      {online && <span className="avatar-presence" />}
    </span>
  );
}

export default Avatar;
