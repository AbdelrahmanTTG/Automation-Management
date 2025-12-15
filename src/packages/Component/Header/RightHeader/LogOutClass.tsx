import { Javascript, LogOutConst } from '@/packages/Constant';
import React from 'react';
import { LogOut } from 'react-feather';
import { Button } from 'reactstrap';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';

const LogOutClass = () => {
  const router = useRouter();
  const logOutUser = () => {
    Cookies.remove('ACCESS_TOKEN');
    router.push('/login');
  };
  return (
    <li className='onhover-dropdown p-0'>
      <Button onClick={logOutUser} color='primary-light'>
        <a>
          <LogOut />
          {LogOutConst}
        </a>
      </Button>
    </li>
  );
};

export default LogOutClass;
