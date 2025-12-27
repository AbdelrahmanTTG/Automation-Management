import { AssetsImagePath, Experience, Follow, Javascript, New } from '@/packages/Constant';
import Image from 'next/image';
import React from 'react';
import { Settings } from 'react-feather';
import { Badge } from 'reactstrap';
import Cookies from 'js-cookie';
const user = Cookies.get("USER") ? JSON.parse(Cookies.get("USER")!) : null;

// console.log(user) 
const SideBarProfile = () => {
  return (
    <div className='sidebar-user text-center'>
      <a className='setting-primary' href={Javascript}>
        <Settings />
      </a>
      {/* <img className='img-90 rounded-circle' alt='Profile Image' src={`${AssetsImagePath}/dashboard/1.png`} /> */}
      <img
        className='img-90 rounded-circle'
        alt='Profile Image'
        src={user?.image || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><circle cx="45" cy="45" r="45" fill="%23ccc"/><text x="50%" y="50%" font-size="36" dominant-baseline="middle" text-anchor="middle" fill="white">U</text></svg>'}
      />

      {/* <div className='badge-bottom'>
        <Badge color='primary'>{New}</Badge>
      </div> */}
      <a href={Javascript}>
        <h6 className='mt-3 f-14 f-w-600'>{user?.username}</h6>
      </a>
      <p className='mb-0 font-roboto'>{user?.title}</p>
      {/* <ul>
        <li>
          <span>
            <span className='counter'>19.8</span>k
          </span>
          <p>{Follow}</p>
        </li>
        <li>
          <span>2 year</span>
          <p>{Experience}</p>
        </li>
        <li>
          <span>
            <span className='counter'>95.2</span>k
          </span>
          <p>{Follow}</p>
        </li>
      </ul> */}
    </div>
  );
};

export default SideBarProfile;
