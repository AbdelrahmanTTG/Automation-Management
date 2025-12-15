import { Notify } from '@/packages/Constant';
import { notificationData } from '@/Data/HeaderData/NotificationData';
import Link from 'next/link';
import React from 'react';
import { Bell } from 'react-feather';
import { Media } from 'reactstrap';

const Notifications = () => {
  return (
    <li className='onhover-dropdown'>
      <div className='notification-box'>
        <Bell />
        <span className='dot-animated' />
      </div>
      <ul className='notification-dropdown onhover-show-div'>
        <li>
          <p className='f-w-700 mb-0'>
            You have 3 {Notify} <span className='pull-right badge badge-primary badge-pill'>4</span>
          </p>
        </li>
        {notificationData.map((element, index) => (
          <li key={index} className={`noti-${element.name}`}>
            <Link href={'/email/mailbox'}>
              <Media>
                <span className={`notification-bg bg-light-${element.name}`}>{element.icon}</span>
                <Media body>
                  <p>{element.status}</p>
                  <span>{element.time}</span>
                </Media>
              </Media>
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
};

export default Notifications;
