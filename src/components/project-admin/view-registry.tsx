"use client";

import React from "react";
import type { PaViewId } from "@/lib/project-admin/types";
import DashboardView from "./views/dashboard";
import ProjectOverviewView from "./views/project-overview";
import UsersView from "./views/users";
import CategoriesView from "./views/categories";
import TasksView from "./views/tasks";
import CollectionStatusView from "./views/collection-status";
import EvidenceView from "./views/evidence";
import EsgSummaryView from "./views/esg-summary";
import ConsolidatedReportView from "./views/consolidated-report";
import SubmissionsView from "./views/submissions";
import CorrectionsView from "./views/corrections";
import { NotificationsView } from "./views/notifications";
import { SettingsView } from "./views/settings";
import ApprovedDatasetView from "./views/approved-dataset";

export const PA_VIEW_COMPONENTS: Record<PaViewId, React.ComponentType> = {
  dashboard: DashboardView,
  "project-overview": ProjectOverviewView,
  users: UsersView,
  categories: CategoriesView,
  tasks: TasksView,
  "collection-status": CollectionStatusView,
  evidence: EvidenceView,
  "esg-summary": EsgSummaryView,
  "consolidated-report": ConsolidatedReportView,
  submissions: SubmissionsView,
  corrections: CorrectionsView,
  notifications: NotificationsView,
  settings: SettingsView,
  "approved-dataset": ApprovedDatasetView,
};
