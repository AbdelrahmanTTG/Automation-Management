import React, { Fragment, useEffect, useState } from 'react';
// import { MENUITEMS } from '@/Data/SidebarData';
// import { MenuItem } from '@/Type/SideBarType';
import SidebarMenuDropDown from './SidebarMenuDropDown';
import { usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import axiosClient from '../../../app/AxiosClint'

const SidebarMenuList = () => {
  const [MENUITEMS, setMENUITEMS] = useState([]);
  const pathname = usePathname();
  const [active, setActive] = useState(pathname ? pathname : '');
  const [prev, setPrev] = useState<number>(0);
  const [linkActive, setLinkActive] = useState(active.split('/')[active.split('/').length - 1]);
  const user = Cookies.get("USER") ? JSON.parse(Cookies.get("USER")!) : null;
  const handleOpen = (title: string | undefined = '', level: number) => {
    if (active.includes(title)) {
      if (active.includes('/')) {
        let tempt = active.split('/');
        tempt.splice(level, active.length - level);
        setActive(tempt.join('/'));
      } else {
        setActive('');
      }
    } else {
      if (level < active.split('/').length) {
        setActive(title);
      } else {
        const tempt = active;
        const concatString = tempt.concat(`/${title}`);
        setActive(concatString);
      }
    }
  };
useEffect(() => {
  const fetchPermission = async () => {
    try {
      const res = await axiosClient.post("api/permission", { role: user?.role });
      const Items = Object.values(res.data.data);
      const newMenu = [{ Items }];
      setMENUITEMS(newMenu);
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || "Request failed");
    } 
  };

  if (user?.role && MENUITEMS.length === 0) {
    fetchPermission();
  }
}, [user]);




  return MENUITEMS?.map((item: MenuItem, index) => {
 
    return (
      <Fragment key={index}>
        <li className='sidebar-main-title'>
          {/* <div>
            <h6>{item.title}</h6>
          </div> */}
        </li>
        <SidebarMenuDropDown linkActive={linkActive} setLinkActive={setLinkActive} setActive={setActive} active={active} items={item.Items} level={0} handleOpen={handleOpen} />
      </Fragment>
    );
  });
};

export default SidebarMenuList;
