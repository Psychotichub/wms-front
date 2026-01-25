import React from 'react';
import EmptyState from './ui/EmptyState';

const SiteRequiredNotice = () => (
  <EmptyState
    title="Select a site first"
    subtitle="Open Settings to add or select a site before entering data."
  />
);

export default SiteRequiredNotice;
