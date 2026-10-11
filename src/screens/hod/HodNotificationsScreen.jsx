import React from "react";
import NotificationsScreen from "../common/NotificationsScreen.jsx";

export default function HodNotificationsScreen() {
  return (
    <NotificationsScreen
      title="Notifications"
      emptyText="No notifications yet. CLO, weekly content, and mapping approvals will appear here."
      cloApprovalPath="/hod/clo-approvals"
    />
  );
}
