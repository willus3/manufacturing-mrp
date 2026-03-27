// Reusable page header — shows a title and optional primary action button.
// Used at the top of every page for consistent layout.

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const PageHeader = ({ title, action, actionLabel, actionIcon: ActionIcon }) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      {action && (
        <Button onClick={() => navigate(action)}>
          {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default PageHeader;
