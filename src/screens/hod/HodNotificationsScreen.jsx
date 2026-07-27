import React from "react";
import NotificationsScreen from "../common/NotificationsScreen.jsx";

export default function HodNotificationsScreen() {
  return (
    <NotificationsScreen
      title="Notifications"
      emptyText="No notifications yet. Pending CLO uploads will appear here."
      cloApprovalPath="/hod/clo-approvals"
    />
  );
}
