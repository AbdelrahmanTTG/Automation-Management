"use client";
import Header from "@/packages/Component/Header/Header";
import SideBarSection from "@/packages/Component/SideBar";
import Footer from "@/packages/Component/Footer";
import { RootState } from "@/packages/Redux/ReduxStore";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";

interface Props {
  children: React.ReactNode;
  classNames?: string;
}

export default function RootLayout({ children, classNames }: Props) {
  const { sideBarType } = useSelector((store: RootState) => store.themeSlice);
  const backgroundColor = useSelector((store: RootState) => store.headerSlice.backGroundChange);
  const path = usePathname();

  useEffect(() => {
    const handleResize = () => {
      const wrapper = document.getElementById("page-wrapper");
      if (!wrapper) return;

      if (window.innerWidth < 992) {
        wrapper.classList.remove("horizontal-wrapper");
        wrapper.classList.add("compact-wrapper");
      } else if (sideBarType !== "horizontal-wrapper") {
        wrapper.classList.remove("horizontal-wrapper");
        wrapper.classList.add("compact-wrapper");
      } else {
        wrapper.classList.add("horizontal-wrapper");
        wrapper.classList.remove("compact-wrapper");
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize(); 
    return () => window.removeEventListener("resize", handleResize);
  }, [sideBarType]);

  if (path === "/login") {
    return <>{children}</>;
  }

  return (
    <div id='mainLayout' className={`${backgroundColor}`}>
      <div className={`page-wrapper ${sideBarType}`} id='page-wrapper'>
        <Header />
        <div className='page-body-wrapper horizontal-menu'>
          <SideBarSection />
          <div className='page-body'>{children}</div>
          <Footer />
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
