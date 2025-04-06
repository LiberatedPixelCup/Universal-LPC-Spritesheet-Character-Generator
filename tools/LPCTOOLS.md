Install WSL w/Miniconda
=============================================

The instructions below can be used to rebuild these files if so desired.

To install lpctools, follow the instructions on the lpctools repository readme:
[https://github.com/bluecarrot16/lpctools]

However, if running on Windows, I HIGHLY recommend [installing WSL first.](#install-wsl)

If you do not have Windows, feel free to [jump to the miniconda installation instructions instead.](#install-miniconda)


#### Install WSL
If running on windows, I highly recommend installing wsl. It makes the process much easier and you can use better commands for managing assets.

I used these instructions to install wsl:
[https://kontext.tech/article/308/how-to-install-windows-subsystem-for-linux-on-a-non-c-drive]

These instructions install Ubuntu, but [you can replace Ubuntu with other distros by clicking here.](https://kontext.tech/article/308/how-to-install-windows-subsystem-for-linux-on-a-non-c-drive#h-download-a-linux-distro). Just remember to change the filename in the instructions below.

Steps:
1. Open Powershell as Administrator
2. Run the following commands:
    1. `Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux`
    2. `cd F:\` (replace F with drive letter)
    3. `mkdir path\to\WSL` (`path\to` can be whatever directory you want)
    4. `cd path\to\WSL` (`path\to` obviously should be whatever path you chose above)
    5. `Invoke-WebRequest -Uri https://aka.ms/wsl-ubuntu-1804 -OutFile Ubuntu.appx -UseBasicParsing` to download Linux
    6. `move .\Ubuntu.appx .\Ubuntu.zip` (rename Ubuntu)
    7. `Expand-Archive .\Ubuntu.zip` (unpack linux)
    8. `cd .\Ubuntu`
    9. `.\ubuntu1804.exe` (installs ubuntu)
    10. Enter new UNIX username (enter username for your wsl linux account)
    11. Enter new UNIX password (enter password)
3. Now Ubuntu will be installed at `F:\path\to\WSL\Ubuntu`
4. The `wsl` command should now allow you to open wsl


#### Install Miniconda

The following instructions are my preferred method to install Miniconda.

You can simply [install via the website](https://docs.conda.io/en/latest/miniconda.html), which is what lpctools recommends.

However, as I use Windows, I found wsl far more effective. [These instructions](https://kontext.tech/article/1064/install-miniconda-and-anaconda-on-wsl-2-or-linux) wound up being more useful for me, and these are the instructions I will detail below.

1. Open a console terminal
    1. On Windows:
        1. Open Powershell as Administrator
        2. Run `wsl` command
2. Run the following commands:
    1. `sudo apt-get update`
    2. `sudo apt-get install wget`
    3. `wget https://repo.anaconda.com/miniconda/Miniconda3-py39_4.12.0-Linux-x86_64.sh`
    4. `sha256sum Miniconda3-py39_4.12.0-Linux-x86_64.sh` (validates checksum to ensure file is correct)
    5. `sh ./Miniconda3-py39_4.12.0-Linux-x86_64.sh` (starts miniconda install)
    6. hit "enter" key
    7. `yes` then hit "enter" key
    8. hit "enter" again to install
    9. `yes` then hit "enter" key again
3. Now exit the terminal and reopen again
4. You should see the following when opening the terminal:
    - `(base) root@COMPUTER-NAME:/mnt/DRIVE_LETTER`
    - The `(base)` at the start of the path indicates miniconda is installed and you are on the base environment.
5. With this you can now move on to installing lpctools with miniconda.


#### Install LPC Tools

Make sure to install miniconda first, regardless of method used.

1. (You may follow the instructions here.)[https://github.com/bluecarrot16/lpctools]
2. Find where on your hard drive you wish to install lpctools too
3. Open a terminal
    - If you are on windows, make sure to open wsl
4. Run the following commands:
    1. `cd /path/to/install/directory/` (the path you decided to install lpctools at)
    2. `git clone https://github.com/bluecarrot16/lpctools`
    3. `cd lpctools`
    4. `conda env create -f environment.yml`
    5. `conda activate lpctools`
    6. `pip install -e .`
5. This will install lpctools, allowing the lpctools environment in miniconda.
6. To enable lpctools commands:
    1. `wsl` (if you are on windows, otherwise skip)
    2. You should see `(base)` in the path as shown above.
    3. `conda activate lpctools` (to enable lpctools commands)
    4. When running the above command, `(base)` should now change to `(lpctools)`
    5. Now everything is set up so you can run lpctools.