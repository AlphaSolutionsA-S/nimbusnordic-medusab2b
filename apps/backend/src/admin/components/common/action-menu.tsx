import {
  DropdownMenu,
  IconButton,
  Tooltip,
  TooltipProvider,
  clx,
} from "@medusajs/ui";

import { EllipsisHorizontal } from "@medusajs/icons";
import { ReactElement, ReactNode } from "react";
import { Link } from "react-router-dom";

export type Action = {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  /** Shown on hover, also while the action is disabled. */
  tooltip?: string;
} & (
  | {
      to: string;
      onClick?: never;
    }
  | {
      onClick: () => void;
      to?: never;
    }
);

export type ActionGroup = {
  actions: Action[];
};

type ActionMenuProps = {
  groups: ActionGroup[];
};

// A disabled DropdownMenu.Item has `pointer-events: none`, so the tooltip hangs on a wrapper that
// still receives hover. The local provider keeps the menu usable outside the dashboard's provider.
const WithTooltip = ({
  tooltip,
  children,
}: {
  tooltip?: string;
  children: ReactElement;
}) => {
  if (!tooltip) {
    return children;
  }

  return (
    <TooltipProvider>
      <Tooltip content={tooltip}>
        <div>{children}</div>
      </Tooltip>
    </TooltipProvider>
  );
};

export const ActionMenu = ({ groups }: ActionMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton size="small" variant="transparent">
          <EllipsisHorizontal />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {groups.map((group, index) => {
          if (!group.actions.length) {
            return null;
          }

          const isLast = index === groups.length - 1;

          return (
            <DropdownMenu.Group key={index}>
              {group.actions.map((action, index) => {
                if (action.onClick) {
                  return (
                    <WithTooltip key={index} tooltip={action.tooltip}>
                      <DropdownMenu.Item
                        disabled={action.disabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Radix calls onClick on a disabled item too; only CSS blocks the pointer.
                          if (action.disabled) {
                            return;
                          }
                          action.onClick();
                        }}
                        className={clx(
                          "[&_svg]:text-ui-fg-subtle flex items-center gap-x-2",
                          {
                            "[&_svg]:text-ui-fg-disabled": action.disabled,
                          }
                        )}
                      >
                        {action.icon}
                        <span>{action.label}</span>
                      </DropdownMenu.Item>
                    </WithTooltip>
                  );
                }

                return (
                  <WithTooltip key={index} tooltip={action.tooltip}>
                    <div>
                      <DropdownMenu.Item
                        className={clx(
                          "[&_svg]:text-ui-fg-subtle flex items-center gap-x-2",
                          {
                            "[&_svg]:text-ui-fg-disabled": action.disabled,
                          }
                        )}
                        asChild
                        disabled={action.disabled}
                      >
                        <Link to={action.to} onClick={(e) => e.stopPropagation()}>
                          {action.icon}
                          <span>{action.label}</span>
                        </Link>
                      </DropdownMenu.Item>
                    </div>
                  </WithTooltip>
                );
              })}
              {!isLast && <DropdownMenu.Separator />}
            </DropdownMenu.Group>
          );
        })}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
