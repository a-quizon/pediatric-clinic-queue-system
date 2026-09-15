import { PqBrand } from "../parent/pqUi";

export default function SplashScreen() {
  return (
    <div className="pq-shell pq-splash" role="img" aria-label="PlusQueue">
      <div className="pq-splash-brand">
        <PqBrand size={96} stacked />
      </div>
      <div className="pq-splash-bar" aria-hidden="true">
        <span className="pq-splash-bar-fill" />
      </div>
    </div>
  );
}
