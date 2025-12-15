// app/layout.tsx
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-vertical-timeline-component/style.min.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'leaflet/dist/leaflet.css';
import 'photoswipe/dist/photoswipe.css';
import "../index.scss";
import Loader from "./loading"
import { Metadata } from "next";
import LayoutProvider from "./Provider";
import NoSsr from "@/packages/utils/NoSsr";
import ErrorBoundary from "@/packages/CommonComponents/ErrorBoundry";

import RootLayoutUI from "./mainLayout"; 
import { ToastContainer } from "react-toastify";

export const metadata: Metadata = {
  title: "Automation management",
  description: "Aixnexus",
  icons: {
    icon: "/assets/images/logo/logo_ar.png",
    shortcut: "/assets/images/logo/logo_ar.png",
    apple: "/assets/images/logo/logo_ar.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="light-only">
        <ErrorBoundary>
          <NoSsr>
            <LayoutProvider>
              <RootLayoutUI classNames="">
                <Loader/>
                {children}
              
              </RootLayoutUI>
              <ToastContainer />
            </LayoutProvider>
          </NoSsr>
        </ErrorBoundary>
      </body>
    </html>
  );
}
