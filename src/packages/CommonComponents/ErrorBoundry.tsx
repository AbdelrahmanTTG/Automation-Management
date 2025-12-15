"use client";
import React, { Component } from "react";
import { unstable_batchedUpdates } from "react-dom";
interface Props {
  children: React.ReactNode;
}
unstable_batchedUpdates(() => {
  console.error = () => {};
});

class ErrorBoundary extends Component<Props> {
  componentDidCatch(error: { message: string | string[] }) {
    if (error.message.includes("ToastContainer")) {
      return;
    }
  }

  render() {
    return this.props.children;
  }
}

export default ErrorBoundary;
