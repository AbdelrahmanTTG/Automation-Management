import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
// import { SidebarMenuDropDownType } from "@/Type/SideBarType";
import { ListGroup, ListGroupItem } from "reactstrap";
import Link from "next/link";

const SidebarMenuDropDown = ({ 
  setLinkActive, 
  linkActive, 
  items, 
  handleOpen, 
  active, 
  level, 
  setActive 
}: SidebarMenuDropDownType) => {
  const router = useRouter();
  const pathname = useSearchParams().get("layout");
  
  return items?.map((element, index) => {
    const displayTitle = element.title || element.name;
    const elementPath = element.path || element.url;
    const elementKey = element.pathSlice || element.title || element.name;
    
    const isActive = 
      (elementKey && active?.includes(elementKey)) ||
      linkActive === elementPath?.split("/").pop();

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      
      if (element.children && element.type === "sub") {
        handleOpen(elementKey, level);
      } else if (elementPath) {
        const lastSegment = elementPath.split("/").pop();
        setLinkActive(lastSegment);
        router.push(`/${elementPath}`);
      }
    };

    return (
      <ListGroupItem className="dropdown" key={index}>
        {element.children && element.type === "sub" ? (
          <a
            href="#"
            onClick={handleClick}
            className={`${isActive ? "active" : ""} ${level === 0 ? "nav-link menu-title" : ""}`}
            id="nav-link"
          >
            {level === 0 ? (
              <>
                {element.icon}
                <span>{displayTitle}</span>
                <div className="according-menu">
                  <i className={`fa ${isActive ? "fa-angle-down" : "fa-angle-right"}`} />
                </div>
              </>
            ) : (
              <>
                {displayTitle}&nbsp;&nbsp;
                <div className="according-menu">
                  <i className={`fa ${isActive ? "fa-angle-down" : "fa-angle-right"}`} />
                </div>
              </>
            )}
          </a>
        ) : (
          <Link
            href={elementPath ? `/${elementPath}` : "#"}
            onClick={(e) => {
              if (elementPath) {
                const lastSegment = elementPath.split("/").pop();
                setLinkActive(lastSegment);
              }
            }}
            className={`${isActive ? "active" : ""} ${level === 0 ? "nav-link menu-title" : ""}`}
            id="nav-link"
          >
            {level === 0 ? (
              <>
                {element.icon}
                <span>{displayTitle}</span>
              </>
            ) : (
              <>
                {displayTitle}
              </>
            )}
          </Link>
        )}

        {element.children && (
          <ListGroup 
            style={{ marginLeft: "arrowStyle" }} 
            className={`nav-submenu ${
              pathname === "compact-sidebar" ? "pt-4" : ""
            } menu-content list-group ${
              isActive ? "d-block" : "d-none"
            }`}
          >
            <SidebarMenuDropDown 
              linkActive={linkActive} 
              setLinkActive={setLinkActive} 
              items={element.children} 
              setActive={setActive} 
              handleOpen={handleOpen} 
              active={active} 
              level={level + 1} 
            />
          </ListGroup>
        )}
      </ListGroupItem>
    );
  });
};

export default SidebarMenuDropDown;