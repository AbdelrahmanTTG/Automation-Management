import React, { Fragment, useEffect, useState } from "react";
import { Nav, NavItem, NavLink, Tooltip } from "reactstrap";
import { Spinner } from "@/packages/AbstractElements";

const ViewIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
    <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
  </svg>
);

const NavComponent = ({ callbackActive, config, loading }) => {
  const [tooltipOpen, setTooltipOpen] = useState({});

  const toggleTooltip = (id) => {
    setTooltipOpen((prevState) => ({
      ...prevState,
      [id]: !prevState[id],
    }));
  };

  return (
    <Fragment>
      <Nav vertical className="nav-modern">
        {loading ? (
          <div className="loader-box">
            <Spinner attrSpinner={{ className: "loader-6" }} />
          </div>
        ) : (
          config?.map((tab) => (
            <NavItem
              key={tab.id}
              className="d-flex align-items-center justify-content-between py-2 px-2 large-text"
            >
              <NavLink
                href="#"
                className="fw-bold nav-label"
                onClick={(e) => {
                  e.preventDefault();
                  callbackActive(tab.id);
                }}
              >
                {tab.name}
              </NavLink>
              <div className="d-flex align-items-center gap-2">
                <span
                  id={`tooltip-${tab.id}`}
                  className="view-icon d-flex align-items-center justify-content-center cursor-pointer"
                >
                  <ViewIcon />
                </span>
                <Tooltip
                  placement="top"
                  isOpen={tooltipOpen[tab.id]}
                  target={`tooltip-${tab.id}`}
                  toggle={() => toggleTooltip(tab.id)}
                >
                  More Info
                </Tooltip>
                <span className="status-dot"></span>
              </div>
            </NavItem>
          ))
        )}
      </Nav>
    </Fragment>
  );
};

export default NavComponent;
