import style from "./LoadingSpinner.style.js";

// Terminus's LoadingSpinner, labelled with the step the work is at.
function LoadingSpinner({ className, label }) {
  return (
    <div className={className} role="status">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

export default style(LoadingSpinner);
