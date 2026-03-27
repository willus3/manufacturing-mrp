// Generic placeholder for module pages that haven't been built yet.
// Shows the page title so you can verify routing works.

import { useLocation } from 'react-router-dom';

const PlaceholderPage = ({ title }) => {
  const location = useLocation();

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="mt-2 text-muted-foreground">
        This page is coming soon. Route: <code className="text-sm">{location.pathname}</code>
      </p>
    </div>
  );
};

export default PlaceholderPage;
